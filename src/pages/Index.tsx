import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap, Shield, Clock } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (!loading && user) {
    navigate("/dashboard");
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-accent/3 rounded-full blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center glow-primary">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <span className="text-xl font-bold">Tele<span className="text-primary text-glow">OTP</span></span>
        </div>
        <Button
          onClick={() => navigate("/auth")}
          className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
        >
          Get Started
        </Button>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4">
        <div className="text-center max-w-2xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
            <Zap className="w-4 h-4" /> Instant Telegram OTP Service
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold text-foreground mb-6 leading-tight">
            Get Telegram OTP
            <br />
            <span className="text-primary text-glow">In Seconds</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto">
            Buy a virtual number, receive your Telegram verification code instantly. 
            Fast, reliable, and secure.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            size="lg"
            className="bg-primary text-primary-foreground hover:bg-primary/90 glow-primary text-lg px-8 h-14"
          >
            Start Now →
          </Button>

          {/* Features */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-16">
            {[
              { icon: Zap, title: "Instant OTP", desc: "Receive codes in real-time" },
              { icon: Shield, title: "Secure", desc: "Your data stays protected" },
              { icon: Clock, title: "24/7 Available", desc: "Numbers always in stock" },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="glass rounded-xl p-6 text-center hover:glow-primary transition-shadow">
                <Icon className="w-8 h-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
