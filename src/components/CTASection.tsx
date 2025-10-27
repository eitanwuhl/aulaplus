
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { motion } from "framer-motion";

const CTASection = () => {
  return (
    <section className="py-20 px-4 bg-gradient-to-br from-blue-600 to-blue-800 text-white">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            ¿Querés ver cómo Aula+ puede transformar tu forma de evaluar?
          </h2>
          <p className="text-xl mb-12 opacity-90">
            Solicita acceso al demo completo y descubre el futuro de la evaluación personalizada
          </p>

          <Card className="bg-white text-gray-800 max-w-md mx-auto">
            <CardContent className="p-6">
              <h3 className="text-xl font-semibold mb-4">Solicitar acceso al demo</h3>
              <div className="space-y-4">
                <Input placeholder="Tu nombre completo" />
                <Input placeholder="Nombre de la institución" />
                <Input placeholder="Correo electrónico" type="email" />
                <Button className="w-full bg-blue-600 hover:bg-blue-700">
                  Enviar solicitud
                </Button>
              </div>
              <p className="text-sm text-gray-600 mt-4">
                Te contactaremos en menos de 24 horas para programar tu demo personalizada
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
