
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { LogOut, Menu, X } from "lucide-react";

interface NavbarProps {
  onLogout: () => void;
}

const Navbar = ({ onLogout }: NavbarProps) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'border-b-2 border-accent' : '';
  };

  const navItems = [
    { path: '/dashboard', label: 'Início' },
    { path: '/lightshow', label: 'Momento Light Show' },
    { path: '/telao', label: 'Momento Telão' },
    { path: '/quiz', label: 'Momento Quiz' },
  ];

  return (
    <nav className="bg-secondary/40 backdrop-blur-lg border-b border-white/10 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="text-xl font-bold hutz-gradient-text">
                HUTZ LIVE
              </Link>
            </div>
            
            {/* Desktop menu */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${isActive(item.path)}`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          
          {/* Logout button */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            <Button 
              variant="ghost" 
              className="text-white/80 hover:text-white"
              onClick={onLogout}
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
          
          {/* Mobile menu button */}
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="text-white/80 hover:text-white"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="sm:hidden animate-fade-in bg-secondary/70 backdrop-blur-lg">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 text-base font-medium ${
                  isActive(item.path)
                    ? 'bg-accent/20 text-white'
                    : 'text-white/70 hover:bg-secondary hover:text-white'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
            <Button
              variant="ghost"
              className="w-full text-left px-3 py-2 text-base font-medium text-white/70 hover:bg-secondary hover:text-white"
              onClick={() => {
                setIsMobileMenuOpen(false);
                onLogout();
              }}
            >
              <LogOut className="h-5 w-5 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
