package middleware

import (
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func AuthRequired() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Get the "Authorization" header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No authorization header provided"})
			c.Abort()
			return
		}

		// 2. Format usually is "Bearer <token>"
		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		// 3. Parse and Validate the token
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			// Validate the algorithm is what we expect
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}

			// Return the secret key from your .env
			return []byte(os.Getenv("JWT_SECRET")), nil
		})

		if err != nil || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired token"})
			c.Abort()
			return
		}

		// 4. Extract the User ID and save it in the Context
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			c.Set("userID", uint(claims["user_id"].(float64)))
			c.Set("userRole", claims["user_role"].(string)) // Store role in context for later use
			c.Set("userName", claims["user_name"].(string))
			c.Set("userEmail", claims["user_email"].(string))
		}

		c.Next()
	}
}

func RolesRequired(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 1. Get role from JWT (stored in context by AuthRequired)
		userRole := c.GetString("userRole")

		// 2. Check if the user's role is in the allowed list
		isAllowed := false
		for _, role := range allowedRoles {
			if role == userRole {
				isAllowed = true
				break
			}
		}

		if !isAllowed {
			c.JSON(http.StatusForbidden, gin.H{"error": "You do not have permission for this action"})
			c.Abort()
			return
		}
		c.Next()
	}
}
