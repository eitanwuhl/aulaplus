Sos un desarrollador senior haciendo una limpieza de repositorio en un proyecto heredado mal estructurado.

Tu tarea es identificar todos los archivos que no deberían estar en el repositorio o que son basura técnica. Quiero que analices:

1. Archivos .md: listá cada uno, leé su contenido y decime si tiene valor real o es basura generada automáticamente / documentación desactualizada / notas de prueba. Para cada uno decime: mantener, actualizar o eliminar.
2. Archivos de configuración huérfanos: configs que no usa nadie, archivos .env commiteados, archivos de setup de herramientas que no están en el proyecto.
3. Archivos de prueba o experimentación: scripts sueltos, archivos con nombres como "test2.js", "prueba.py", "backup_old", etc.
4. Dependencias declaradas pero no usadas: revisá el package.json (o equivalente) y buscá dependencias que no se importen en ningún lado.
5. Código comentado en masa: bloques grandes de código comentado que claramente son "por las dudas".
6. Assets sin usar: imágenes, fuentes, iconos que estén en el repo pero no se referencien en ningún lado.

Para cada categoría dame:
- Una lista concreta de archivos con su path
- La acción recomendada (eliminar / mover / reescribir)
- Si hay algún riesgo en eliminarlo

Al final dame el comando o la secuencia de pasos para hacer la limpieza de forma segura.