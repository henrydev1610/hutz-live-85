
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { Eye, EyeOff, AudioWaveform } from "lucide-react";
import { useAuth } from '@/contexts/AuthContext';
import Captcha from '@/components/auth/Captcha';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
});

const signupSchema = z.object({
  fullName: z.string().min(2, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirme sua senha"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não correspondem",
  path: ["confirmPassword"],
});

type LoginFormValues = z.infer<typeof loginSchema>;
type SignupFormValues = z.infer<typeof signupSchema>;

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [captchaVerified, setCaptchaVerified] = useState(false);
  
  const { signIn, signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const signupForm = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleLogin = async (values: LoginFormValues) => {
    if (!captchaVerified) {
      toast({
        variant: "destructive",
        title: "Verifique o captcha",
        description: "Por favor, confirme que você não é um robô.",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signIn(values.email, values.password);
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no login",
          description: error.message || "Verifique suas credenciais e tente novamente.",
        });
      } else {
        toast({
          title: "Login bem-sucedido",
          description: "Bem-vindo ao Hutz Live!",
        });
        navigate("/dashboard");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no login",
        description: "Ocorreu um problema durante o login.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (values: SignupFormValues) => {
    if (!captchaVerified) {
      toast({
        variant: "destructive",
        title: "Verifique o captcha",
        description: "Por favor, confirme que você não é um robô.",
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signUp(values.email, values.password, values.fullName);
      
      if (error) {
        toast({
          variant: "destructive",
          title: "Erro no cadastro",
          description: error.message || "Não foi possível criar sua conta.",
        });
      } else {
        toast({
          title: "Cadastro bem-sucedido",
          description: "Sua conta foi criada. Você já pode fazer login.",
        });
        setActiveTab("login");
        loginForm.setValue("email", values.email);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro no cadastro",
        description: "Ocorreu um problema durante o cadastro.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCaptchaVerify = (verified: boolean) => {
    setCaptchaVerified(verified);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black p-4">
      <div className="w-full max-w-md text-center mb-8">
        <AudioWaveform className="h-16 w-16 text-accent mx-auto mb-4 animate-pulse" />
        <h1 className="text-4xl font-extrabold mb-2 hutz-gradient-text">
          HUTZ LIVE
        </h1>
        <p className="text-white/70">
          Plataforma SaaS para experiências interativas em eventos
        </p>
      </div>
      
      <Card className="w-full max-w-md mx-auto bg-secondary/40 backdrop-blur-lg border border-white/10">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Acesso à Plataforma</CardTitle>
          <CardDescription>
            Entre ou crie uma conta para acessar o Hutz Live
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Cadastro</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="seu@email.com"
                            className="hutz-input"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Sua senha"
                              className="hutz-input pr-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Captcha onVerify={handleCaptchaVerify} />
                  
                  <Button
                    type="submit"
                    className="w-full hutz-button-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? "Autenticando..." : "Entrar"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
            
            <TabsContent value="signup">
              <Form {...signupForm}>
                <form onSubmit={signupForm.handleSubmit(handleSignup)} className="space-y-4">
                  <FormField
                    control={signupForm.control}
                    name="fullName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome Completo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Seu nome completo"
                            className="hutz-input"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="seu@email.com"
                            className="hutz-input"
                            disabled={isLoading}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Senha</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Sua senha"
                              className="hutz-input pr-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={signupForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirmar Senha</FormLabel>
                        <div className="relative">
                          <FormControl>
                            <Input
                              type={showConfirmPassword ? "text" : "password"}
                              placeholder="Confirme sua senha"
                              className="hutz-input pr-10"
                              disabled={isLoading}
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            className="absolute inset-y-0 right-0 flex items-center pr-3"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? (
                              <EyeOff className="h-5 w-5 text-gray-400" />
                            ) : (
                              <Eye className="h-5 w-5 text-gray-400" />
                            )}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <Captcha onVerify={handleCaptchaVerify} />
                  
                  <Button
                    type="submit"
                    className="w-full hutz-button-primary"
                    disabled={isLoading}
                  >
                    {isLoading ? "Cadastrando..." : "Criar Conta"}
                  </Button>
                </form>
              </Form>
            </TabsContent>
          </Tabs>
        </CardContent>
        <CardFooter className="flex justify-center border-t border-white/10 pt-4">
          <a href="#" className="text-sm text-white/70 hover:text-white">
            Esqueceu sua senha?
          </a>
        </CardFooter>
      </Card>
      
      <div className="mt-8 text-white/40 text-center text-sm max-w-md">
        <p>
          Ao acessar a plataforma Hutz Live, você concorda com nossos termos de serviço e política de privacidade.
        </p>
      </div>
    </div>
  );
};

export default Auth;
