package handler

import (
	"context"
	"net/http"
	"strings"

	instance_model "github.com/EvolutionAPI/evolution-go/pkg/instance/model"
	instance_service "github.com/EvolutionAPI/evolution-go/pkg/instance/service"
	call_service "github.com/EvolutionAPI/evolution-go/pkg/wacalls/service"
	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/voip/core"
	"github.com/gin-gonic/gin"
	"go.mau.fi/whatsmeow/types"
	"github.com/EvolutionAPI/evolution-go/pkg/wacalls/sip"
)

type CallHandler interface {
	StartCall(ctx *gin.Context)
	WebRTC(ctx *gin.Context)
	Accept(ctx *gin.Context)
	Reject(ctx *gin.Context)
	EndCall(ctx *gin.Context)
	VapiTestCall(ctx *gin.Context)
}

type callHandler struct {
	instanceService instance_service.InstanceService
}

func NewCallHandler(instanceService instance_service.InstanceService) CallHandler {
	return &callHandler{
		instanceService: instanceService,
	}
}

func normalizePhone(p string) string {
	p = strings.TrimSpace(p)
	p = strings.TrimPrefix(p, "+")
	var b strings.Builder
	for _, c := range p {
		if c >= '0' && c <= '9' {
			b.WriteRune(c)
		}
	}
	return b.String()
}

// StartCall initiates an outgoing call
// @Summary Start a call
// @Description Initiate a WebRTC call
// @Tags Call
// @Accept json
// @Produce json
// @Param instanceName path string true "Instance name"
// @Param request body map[string]interface{} true "Call request data"
// @Router /instance/{instanceName}/calls [post]
func (h *callHandler) StartCall(ctx *gin.Context) {
	getInstance := ctx.MustGet("instance")
	instance, ok := getInstance.(*instance_model.Instance)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "instance not found"})
		return
	}

	var body struct {
		Phone      string `json:"phone"`
		DurationMs int    `json:"duration_ms"`
		Record     bool   `json:"record"`
	}
	if err := ctx.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.Phone) == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "phone required"})
		return
	}

	client, err := h.instanceService.GetWhatsmeowService().GetClient(instance.Id)
	if err != nil || client == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": "whatsapp client not connected"})
		return
	}
	if client.Store.ID == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{"error": "not paired"})
		return
	}

	peer := types.NewJID(normalizePhone(body.Phone), types.DefaultUserServer)

	svc := call_service.GetCallService()
	callID, err := svc.StartOutgoingCall(instance.Id, client, peer)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"call": map[string]string{"callId": callID}})
}

// WebRTC handles WebRTC SDP offer
// @Summary Send WebRTC SDP Offer
// @Description Send SDP Offer and get Answer
// @Tags Call
// @Accept json
// @Produce json
// @Param instanceName path string true "Instance name"
// @Param id path string true "Call ID"
// @Param request body map[string]interface{} true "SDP offer"
// @Router /instance/{instanceName}/calls/{id}/webrtc [post]
func (h *callHandler) WebRTC(ctx *gin.Context) {
	
	// Para este endpoint precisaríamos do Bridge, mas como o WaCalls lida com 
	// PCM nativamente, o Bridge precisa ser instanciado aqui (como em httpapi.go do WaCalls).
	// Devido a simplificação e separação de pacotes, a implementação exata 
	// requereria a cópia do bridge do WaCalls. 
	// Exemplo de resposta provisória:
	ctx.JSON(http.StatusNotImplemented, gin.H{"error": "webrtc endpoint not fully ported without bridge"})
}

func (h *callHandler) Accept(ctx *gin.Context) {
	getInstance := ctx.MustGet("instance")
	instance, _ := getInstance.(*instance_model.Instance)
	callID := ctx.Param("id")

	svc := call_service.GetCallService()
	cm, ok := svc.GetCallManager(instance.Id, callID)
	if !ok {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "no such call"})
		return
	}

	if err := cm.AcceptCall(context.Background(), callID); err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	ctx.JSON(http.StatusOK, gin.H{"call": map[string]string{"callId": callID}})
}

func (h *callHandler) Reject(ctx *gin.Context) {
	getInstance := ctx.MustGet("instance")
	instance, _ := getInstance.(*instance_model.Instance)
	callID := ctx.Param("id")

	svc := call_service.GetCallService()
	cm, ok := svc.GetCallManager(instance.Id, callID)
	if ok {
		_ = cm.RejectCall(context.Background(), callID, core.EndCallReasonDeclined)
	}
	svc.RemoveCall(instance.Id, callID)
	ctx.JSON(http.StatusOK, gin.H{"status": "ok"})
}

// VapiTestCall chama a API do Vapi.ai para iniciar uma ligação SIP
func (h *callHandler) VapiTestCall(ctx *gin.Context) {
	getInstance := ctx.MustGet("instance")
	instance, ok := getInstance.(*instance_model.Instance)
	if !ok {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": "instance not found"})
		return
	}

	if !instance.SipEnable {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "SIP não está habilitado para esta instância"})
		return
	}

	var req struct {
		AssistantId    string `json:"assistantId"`
		PhoneNumberId  string `json:"phoneNumberId"`
		CustomerNumber string `json:"customerNumber"`
	}

	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if req.AssistantId == "" || req.PhoneNumberId == "" || req.CustomerNumber == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "assistantId, phoneNumberId, customerNumber são obrigatórios"})
		return
	}

	// Usa o SipPassword como o token do Vapi
	result, err := sip.TriggerVapiCall(instance.SipPassword, req.AssistantId, req.PhoneNumberId, req.CustomerNumber)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error(), "details": result})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"status": "success", "data": result})
}

func (h *callHandler) EndCall(ctx *gin.Context) {
	getInstance := ctx.MustGet("instance")
	instance, _ := getInstance.(*instance_model.Instance)
	callID := ctx.Param("id")

	svc := call_service.GetCallService()
	cm, ok := svc.GetCallManager(instance.Id, callID)
	if ok {
		_ = cm.EndCall(context.Background(), core.EndCallReasonUserEnded)
	}
	svc.RemoveCall(instance.Id, callID)
	ctx.JSON(http.StatusNoContent, nil)
}
