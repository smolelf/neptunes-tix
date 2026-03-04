package api

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sort"
	"strings"
)

// VerifyBillplzSignature checks if the incoming webhook is authentic
func VerifyBillplzSignature(params map[string]string, signatureKey string) bool {
	// 1. Get the signature sent by Billplz
	receivedSign := params["x_signature"]
	if receivedSign == "" {
		return false
	}

	// 2. Extract and sort all keys alphabetically, excluding x_signature
	var keys []string
	for k := range params {
		if k != "x_signature" {
			keys = append(keys, k)
		}
	}
	sort.Strings(keys)

	// 3. Construct the source string (value1|value2|value3...)
	var parts []string
	for _, k := range keys {
		parts = append(parts, fmt.Sprintf("%s%s", k, params[k]))
	}
	sourceString := strings.Join(parts, "|")

	// 4. Calculate HMAC-SHA256
	h := hmac.New(sha256.New, []byte(signatureKey))
	h.Write([]byte(sourceString))
	expectedSign := hex.EncodeToString(h.Sum(nil))

	// 5. Compare signatures
	return hmac.Equal([]byte(receivedSign), []byte(expectedSign))
}
