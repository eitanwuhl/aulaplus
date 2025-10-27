
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

const WhatIsSection = () => {
  const features = [
    {
      icon: "🧠",
      title: "Perfiles de aprendizaje",
      desc: "Identificación del estilo de aprendizaje personal de cada estudiante."
    },
    {
      icon: "👥",
      title: "Información personalizada de cada estudiante por parte del equipo psicopedagógico",
      desc: "Sugerencias y ajustes necesarios para alcanzar el mejor despliegue del potencial de aprendizaje de cada alumno."
    },
    {
      icon: "🤖",
      title: "Asistente al Docente",
      desc: "A partir de los objetivos que el docente tiene y la diversidad del grupo, se formulan propuestas que se ajustan a las necesidades de todos los estudiantes."
    },
    {
      icon: "📈",
      title: "Seguimiento de trayectoria educativa",
      desc: "Actualización de las necesidades individuales en función de los logros obtenidos."
    }
  ];

  return (
    <section id="que-es" className="py-20 px-4 bg-white">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            ¿Qué es <span className="text-blue-600">Aula+</span>?
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            La plataforma que pone al estudiante en el centro, 
            integrando las necesidades individuales en procesos de evaluación colectiva.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <Card className="h-full bg-gradient-to-br from-blue-50 to-yellow-50 border-0 shadow-lg hover:shadow-xl transition-all duration-300">
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-4">{item.icon}</div>
                  <h3 className="font-semibold text-gray-800 mb-3">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhatIsSection;
