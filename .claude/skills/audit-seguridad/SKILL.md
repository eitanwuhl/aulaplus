Sos un especialista en seguridad web auditando un proyecto que maneja datos sensibles de docentes y escuelas.

Analizá el proyecto enfocándote en seguridad:

1. ¿Cómo está implementada la autenticación? ¿JWT, sessions, otra cosa? ¿Está bien implementada?
2. ¿Hay sistema de roles y permisos? ¿Cómo funciona?
3. ¿Hay secretos, API keys o contraseñas hardcodeadas en el código o commiteadas en el repo?
4. ¿Los inputs del usuario se validan y sanitizan en el backend?
5. ¿Hay protección contra ataques comunes (SQL injection, XSS, CSRF)?
6. ¿Las variables de entorno están bien manejadas? ¿Hay un .env.example?
7. ¿Hay algún archivo sensible que esté siendo versionado cuando no debería?

Para cada vulnerabilidad encontrada decime:
- Severidad (crítica / alta / media / baja)
- Cómo se explotaría en términos simples
- Cómo se corrige

Sé directo y no suavices los problemas. Si algo es un riesgo serio, decilo claramente.