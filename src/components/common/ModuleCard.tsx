
import { ReactNode } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from 'react-router-dom';

interface ModuleCardProps {
  title: string;
  description: string;
  icon: ReactNode;
  path: string;
}

const ModuleCard = ({ title, description, icon, path }: ModuleCardProps) => {
  return (
    <Card className="h-full flex flex-col bg-secondary/40 backdrop-blur-lg border border-white/10 hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-1">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-center mb-6">
          <div className="w-20 h-20 flex items-center justify-center bg-accent/10 rounded-2xl text-accent">
            {icon}
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow px-8">
        <CardDescription className="text-white/70 text-center text-lg leading-relaxed">
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-4 pb-8 flex justify-center">
        <Button asChild size="lg" className="hutz-button-primary text-lg px-8">
          <Link to={path}>Acessar</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ModuleCard;
