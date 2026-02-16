package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func AdminOnly() gin.HandlerFunc {
	return func(c *gin.Context) {
		// We get the user from the database or the context
		// For simplicity, let's assume you've stored the role in the JWT claims
		// and extracted it in your AuthRequired middleware.

		role := c.GetString("userRole")
		if role != "admin" {
			c.JSON(http.StatusForbidden, gin.H{"error": "Admins only!"})
			c.Abort()
			return
		}
		c.Next()
	}
}
