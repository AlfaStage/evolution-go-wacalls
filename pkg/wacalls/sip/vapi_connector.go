package sip

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

type VapiPayload struct {
	Customers     []Customer `json:"customers"`
	AssistantId   string     `json:"assistantId"`
	PhoneNumberId string     `json:"phoneNumberId"`
}

type Customer struct {
	Number string `json:"number"`
}

// TriggerVapiCall chama a API do Vapi.ai para iniciar uma ligação SIP
func TriggerVapiCall(vapiToken, assistantId, phoneNumberId, customerNumber string) (map[string]interface{}, error) {
	payload := VapiPayload{
		Customers: []Customer{
			{Number: customerNumber},
		},
		AssistantId:   assistantId,
		PhoneNumberId: phoneNumberId,
	}

	jsonPayload, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao converter payload para json: %v", err)
	}

	req, err := http.NewRequest("POST", "https://api.vapi.ai/call", bytes.NewBuffer(jsonPayload))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisicao: %v", err)
	}

	req.Header.Set("Authorization", "Bearer "+vapiToken)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("erro ao fazer a chamada para Vapi: %v", err)
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta: %v", err)
	}

	if resp.StatusCode >= 400 {
		return result, fmt.Errorf("vapi API retornou erro status %d", resp.StatusCode)
	}

	return result, nil
}
