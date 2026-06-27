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

// StartCall initiates an outgoing WhatsApp VoIP call
// @Summary Iniciar ligação WhatsApp
// @Description Inicia uma ligação VoIP direta via WhatsApp para o número especificado. A instância precisa estar conectada e pareada.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param request body object true "Dados da ligação" example({"phone":"+5511999999999","duration_ms":30000,"record":false})
// @Success 200 {object} object "Ligação iniciada com sucesso" example({"call":{"callId":"abc123"}})
// @Failure 400 {object} object "Número de telefone obrigatório"
// @Failure 503 {object} object "WhatsApp não conectado"
// @Router /instance/{instanceName}/wacalls/start [post]
// @Security ApiKeyAuth
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

// WebRTC handles WebRTC SDP exchange
// @Summary WebRTC SDP Exchange
// @Description Envia um SDP Offer e recebe um SDP Answer para a negociação WebRTC da ligação.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param id path string true "ID da ligação"
// @Param request body object true "SDP Offer"
// @Success 200 {object} object "SDP Answer"
// @Failure 501 {object} object "Endpoint não totalmente portado"
// @Router /instance/{instanceName}/wacalls/{id}/webrtc [post]
// @Security ApiKeyAuth
func (h *callHandler) WebRTC(ctx *gin.Context) {
	ctx.JSON(http.StatusNotImplemented, gin.H{"error": "webrtc endpoint not fully ported without bridge"})
}

// Accept accepts an incoming call
// @Summary Aceitar ligação
// @Description Aceita uma ligação recebida (incoming call) nesta instância.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param id path string true "ID da ligação"
// @Success 200 {object} object "Ligação aceita"
// @Failure 404 {object} object "Ligação não encontrada"
// @Failure 500 {object} object "Erro interno"
// @Router /instance/{instanceName}/wacalls/{id}/accept [post]
// @Security ApiKeyAuth
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

// Reject rejects an incoming call
// @Summary Rejeitar ligação
// @Description Rejeita uma ligação recebida (incoming call) nesta instância.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param id path string true "ID da ligação"
// @Success 200 {object} object "Ligação rejeitada"
// @Router /instance/{instanceName}/wacalls/{id}/reject [post]
// @Security ApiKeyAuth
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

// VapiTestCall triggers a test call via Vapi.ai SIP
// @Summary Testar ligação via Vapi.ai
// @Description Dispara uma ligação de teste usando a integração SIP com o Vapi.ai. O SIP deve estar habilitado e configurado com o token do Vapi na instância.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param request body object true "Dados do teste Vapi" example({"assistantId":"asst_xxx","phoneNumberId":"phone_xxx","customerNumber":"+5511999999999"})
// @Success 200 {object} object "Ligação Vapi iniciada" example({"status":"success","data":{}})
// @Failure 400 {object} object "SIP não habilitado ou dados inválidos"
// @Failure 500 {object} object "Erro ao chamar Vapi"
// @Router /instance/{instanceName}/wacalls/vapi-test [post]
// @Security ApiKeyAuth
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

// EndCall terminates an active call
// @Summary Encerrar ligação
// @Description Encerra uma ligação ativa nesta instância.
// @Tags WaCalls
// @Accept json
// @Produce json
// @Param instanceName path string true "Nome da instância"
// @Param id path string true "ID da ligação"
// @Success 204 "Ligação encerrada"
// @Router /instance/{instanceName}/wacalls/{id}/end [post]
// @Security ApiKeyAuth
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
