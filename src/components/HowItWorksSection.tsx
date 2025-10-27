import { motion } from "framer-motion";

const HowItWorksSection = () => {
  const steps = [
    {
      step: 1,
      title: "Evaluación inicial del estudiante",
      desc: "El alumno completa una serie de preguntas que permitirán identificar su preferencia de acceso a los contenidos y perfil de aprendizaje",
      icon: "👨‍🎓",
      color: "bg-blue-100"
    },
    {
      step: 2,
      title: "Ingreso de las sugerencias y ajustes necesarios (Adecuación curricular)",
      desc: "El equipo psicopedagógico y docente ingresan las adaptaciones específicas necesarias para cada estudiante en el perfil individual",
      icon: "🔧",
      color: "bg-yellow-100"
    },
    {
      step: 3,
      title: "Configuración de la evaluación",
      desc: "El docente selecciona la materia, define los temas a evaluar y puede subir un prototipo de prueba como base",
      icon: "🎯",
      color: "bg-blue-100"
    },
    {
      step: 4,
      title: "Devolución de la propuesta diversificada para el grupo",
      desc: "La IA crea las mínimas versiones necesarias de consignas evaluatorias para contemplar todos los perfiles del grupo, indicando qué estudiantes contempla cada versión e indicando cuales fueron las diferentes herramientas utilizadas para acceder a los contenidos evaluados en la consigna",
      icon: "⚡",
      color: "bg-yellow-100"
    },
    {
      step: 5,
      title: "Seguimiento de los resultados de cada alumno",
      desc: "Dentro del perfil del alumno se ingresarán los resultados cuantitativos de las evaluaciones, asi como los comentarios (Datos cualitativos) que el docente considere pertinentes",
      icon: "📊",
      color: "bg-blue-100"
    }
  ];

  return (
    <section className="py-20 px-4 bg-gradient-to-br from-blue-50 to-yellow-50">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            ¿Cómo funciona?
          </h2>
          <p className="text-xl text-gray-600">
            Un proceso simple e inteligente en 5 pasos
          </p>
        </motion.div>

        <div className="space-y-12">
          {steps.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: index % 2 === 0 ? -50 : 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: index * 0.2 }}
              viewport={{ once: true }}
              className={`flex items-center gap-8 ${index % 2 === 1 ? 'flex-row-reverse' : ''}`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold text-lg">
                    {item.step}
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">{item.title}</h3>
                </div>
                <p className="text-gray-600 text-lg">{item.desc}</p>
              </div>
              <div className={`w-24 h-24 ${item.color} rounded-full flex items-center justify-center text-4xl`}>
                {item.icon}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
