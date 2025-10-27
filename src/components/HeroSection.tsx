
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface HeroSectionProps {
  onScrollToSection: (sectionId: string) => void;
  onStartDiagnostic: () => void;
}

const HeroSection = ({ onScrollToSection, onStartDiagnostic }: HeroSectionProps) => {
  return (
    <section className="min-h-screen flex items-center justify-center px-4 py-20">
      <div className="max-w-4xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-6xl md:text-8xl font-bold text-gray-800 mb-4">
            Aula<span className="text-blue-600">+</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12">
            Mejorando la experiencia de educar y aprender
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Button 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={() => onScrollToSection('que-es')}
          >
            Conocé más sobre Aula+
          </Button>
          <Button 
            variant="outline" 
            size="lg" 
            className="text-lg px-8 py-6"
            onClick={onStartDiagnostic}
          >
            Completar diagnóstico como estudiante
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
