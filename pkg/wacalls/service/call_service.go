package service

import (
	"context"
	"log/slog"
	"os"
	"sync"
	"time"

	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/wa"
	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/voip/call"
	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/voip/core"
	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/voip/signaling"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/types"
	waBinary "go.mau.fi/whatsmeow/binary"
	"go.mau.fi/whatsmeow/types/events"
)

type activeCall struct {
	cm *call.CallManager
}

type callRegistry struct {
	mu    sync.RWMutex
	calls map[string]*activeCall
}

func newCallRegistry() *callRegistry {
	return &callRegistry{calls: make(map[string]*activeCall)}
}

func (r *callRegistry) add(id string, ac *activeCall) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.calls[id] = ac
}

func (r *callRegistry) get(id string) (*activeCall, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	ac, ok := r.calls[id]
	return ac, ok
}

func (r *callRegistry) remove(id string) (*activeCall, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ac, ok := r.calls[id]
	delete(r.calls, id)
	return ac, ok
}

type CallService struct {
	mu       sync.RWMutex
	sessions map[string]*callRegistry
	log      *slog.Logger
}

var instance *CallService
var once sync.Once

func GetCallService() *CallService {
	once.Do(func() {
		instance = &CallService{
			sessions: make(map[string]*callRegistry),
			log:      slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})),
		}
	})
	return instance
}

func (s *CallService) ensureRegistry(instanceId string) *callRegistry {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.sessions[instanceId]; !ok {
		s.sessions[instanceId] = newCallRegistry()
	}
	return s.sessions[instanceId]
}

func (s *CallService) CreateCallManager(instanceId string, client *whatsmeow.Client, callID string) *call.CallManager {
	reg := s.ensureRegistry(instanceId)
	cm := call.NewCallManager(wa.NewSocket(client), s.log.With("instance", instanceId))
	reg.add(callID, &activeCall{cm: cm})
	return cm
}

func (s *CallService) GetCallManager(instanceId string, callID string) (*call.CallManager, bool) {
	reg := s.ensureRegistry(instanceId)
	ac, ok := reg.get(callID)
	if !ok {
		return nil, false
	}
	return ac.cm, true
}

func (s *CallService) RemoveCall(instanceId string, callID string) {
	reg := s.ensureRegistry(instanceId)
	reg.remove(callID)
}

func callIDFromNode(node *waBinary.Node) string {
	if node == nil {
		return ""
	}
	id, _ := node.Attrs["call-id"].(string)
	return id
}

func wrapCall(from types.JID, node *waBinary.Node) *waBinary.Node {
	return &waBinary.Node{
		Tag: "call",
		Attrs: waBinary.Attrs{
			"from":    from.String(),
			"call-id": callIDFromNode(node),
		},
		Content: []waBinary.Node{*node},
	}
}

// HandleEvent should be called from the main Whatsmeow event handler
func (s *CallService) HandleEvent(instanceId string, client *whatsmeow.Client, evt interface{}) {
	reg := s.ensureRegistry(instanceId)
	
	switch e := evt.(type) {
	case *events.CallOffer:
		callID := e.CallID
		cm := s.CreateCallManager(instanceId, client, callID)
		cm.OnIncoming = func(c *call.CallInfo) {
			s.log.Info("Incoming call", "callID", c.CallID)
		}
		cm.OnEnded = func(c *call.CallInfo) {
			s.RemoveCall(instanceId, c.CallID)
		}
		node := wrapCall(e.BasicCallEvent.From, e.Data)
		cm.HandleNode(node)

	case *events.CallOfferInvite:
		callID := e.CallID
		if ac, ok := reg.get(callID); ok {
			node := wrapCall(e.BasicCallEvent.From, e.Data)
			ac.cm.HandleNode(node)
		}

	case *events.CallAccept:
		if ac, ok := reg.get(e.CallID); ok {
			node := wrapCall(e.BasicCallEvent.From, e.Data)
			ac.cm.HandleNode(node)
		}

	case *events.CallReject:
		if ac, ok := reg.get(e.CallID); ok {
			node := wrapCall(e.BasicCallEvent.From, e.Data)
			ac.cm.HandleNode(node)
		}

	case *events.CallTerminate:
		if ac, ok := reg.get(e.CallID); ok {
			node := wrapCall(e.BasicCallEvent.From, e.Data)
			ac.cm.HandleNode(node)
		}

	case *events.CallRelayLatency:
		if ac, ok := reg.get(e.CallID); ok {
			node := wrapCall(e.BasicCallEvent.From, e.Data)
			ac.cm.HandleNode(node)
		}
	}
}

// StartOutgoingCall starts a new call
func (s *CallService) StartOutgoingCall(instanceId string, client *whatsmeow.Client, peer types.JID) (string, error) {
	callID := signaling.GenerateCallID()
	cm := s.CreateCallManager(instanceId, client, callID)
	
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	
	isVideo := false
	if err := cm.StartCall(ctx, callID, peer, isVideo); err != nil {
		s.RemoveCall(instanceId, callID)
		return "", err
	}
	return callID, nil
}
