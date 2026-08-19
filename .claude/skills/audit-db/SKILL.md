Sos un DBA y desarrollador backend senior auditando la capa de datos de un proyecto heredado.

Analizá todo lo relacionado a la base de datos en el proyecto:

1. ¿Qué motor de base de datos se usa? ¿Es apropiado para este tipo de sistema?
2. ¿Cómo se conecta la aplicación a la base de datos? ¿Hay un ORM, query builder, o SQL crudo?
3. ¿Existe algún sistema de migraciones? ¿O el schema se modificó a mano?
4. ¿El modelo de datos tiene sentido para un portal de docentes? ¿Hay tablas mal diseñadas, relaciones faltantes, o datos denormalizados que no deberían estarlo?
5. ¿Hay queries peligrosas (susceptibles a SQL injection)?
6. ¿Se usan transacciones donde corresponde?
7. ¿Hay algún sistema de backup configurado?

Para cada problema encontrado:
- Impacto real en el sistema
- Cómo arreglarlo
- Si requiere migración de datos existentes

Al final, si tuvieras que diseñar el modelo de datos desde cero para este sistema, ¿qué entidades principales tendría y cómo se relacionarían?