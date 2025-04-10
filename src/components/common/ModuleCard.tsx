
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
    <Card className="h-full flex flex-col bg-secondary/40 backdrop-blur-lg border border-white/10 hover:border-white/30 transition-all duration-300 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-center mb-4 text-accent">
          <div className="w-12 h-12 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <CardTitle className="text-xl font-bold text-center">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex-grow">
        <CardDescription className="text-white/70 text-center">
          {description}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-2 pb-6 flex justify-center">
        <Button asChild className="hutz-button-primary">
          <Link to={path}>Acessar</Link>
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ModuleCard;
