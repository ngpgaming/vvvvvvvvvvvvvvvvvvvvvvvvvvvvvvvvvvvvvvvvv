import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageSquare, LogOut, ShieldCheck, Copy, Loader2, CheckCircle2, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Service {
  id: string;
  name: string;
  price: number;
  stock: number;
}

interface Order {
  id: string;
  phone_number: string;
  otp: string | null;
  status: string;
  created_at: string;
  telegram_services: { name: string } | null;
}

const Dashboard = () => {
  const { user, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [buyingService, setBuyingService] = useState<string | null>(null);

  useEffect(() => {
    fetchServices();
    fetchOrders();

    // Realtime OTP subscription
    const channel = supabase
      .channel("orders-realtime")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => {
          const updated = payload.new as any;
          setOrders((prev) =>
            prev.map((o) =>
              o.id === updated.id
                ? { ...o, otp: updated.otp, status: updated.status }
                : o
            )
          );
          if (updated.otp) {
            toast.success("OTP received! 🎉");
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchServices = async () => {
    const { data: servicesData } = await supabase
      .from("telegram_services")
      .select("id, name, price");
    
    if (servicesData) {
      const servicesWithStock = await Promise.all(
        servicesData.map(async (s) => {
          const { count } = await supabase
            .from("phone_numbers")
            .select("*", { count: "exact", head: true })
            .eq("service_id", s.id)
            .eq("is_sold", false);
          return { ...s, stock: count || 0 };
        })
      );
      setServices(servicesWithStock);
    }
  };

  const fetchOrders = async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, phone_number, otp, status, created_at, telegram_services(name)")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setOrders(data as any);
  };

  const buyNumber = async (serviceId: string) => {
    setBuyingService(serviceId);
    try {
      // Get an available number
      const { data: number, error: numError } = await supabase
        .from("phone_numbers")
        .select("id, phone_number")
        .eq("service_id", serviceId)
        .eq("is_sold", false)
        .limit(1)
        .maybeSingle();

      if (numError || !number) {
        toast.error("No numbers available!");
        return;
      }

      // Create order
      const { error: orderError } = await supabase.from("orders").insert({
        user_id: user!.id,
        service_id: serviceId,
        phone_number_id: number.id,
        phone_number: number.phone_number,
      });

      if (orderError) {
        toast.error("Failed to create order");
        return;
      }

      // Mark number as sold (this will fail with RLS for regular users, needs admin update)
      // We'll handle this via admin panel or a function
      toast.success("Number purchased! Waiting for OTP...");
      fetchOrders();
      fetchServices();
    } finally {
      setBuyingService(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border/50 glass sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <span className="text-xl font-bold">Tele<span className="text-primary">OTP</span></span>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/admin")}
                className="border-primary/30 text-primary hover:bg-primary/10"
              >
                <ShieldCheck className="w-4 h-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={signOut} className="text-muted-foreground hover:text-foreground">
              <LogOut className="w-4 h-4 mr-1" /> Logout
            </Button>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Services */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Package className="w-6 h-6 text-primary" />
            Available Services
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((s) => (
              <div key={s.id} className="glass rounded-xl p-6 hover:glow-primary transition-shadow">
                <h3 className="text-lg font-semibold text-foreground mb-2">{s.name}</h3>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-primary font-mono text-2xl font-bold">₹{s.price}</span>
                  <span className="text-sm text-muted-foreground">
                    Stock: <span className={s.stock > 0 ? "text-accent" : "text-destructive"}>{s.stock}</span>
                  </span>
                </div>
                <Button
                  onClick={() => buyNumber(s.id)}
                  disabled={s.stock === 0 || buyingService === s.id}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 glow-primary"
                >
                  {buyingService === s.id ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Buying...</>
                  ) : s.stock === 0 ? "Out of Stock" : "Buy Number"}
                </Button>
              </div>
            ))}
            {services.length === 0 && (
              <div className="col-span-full text-center py-12 text-muted-foreground">
                No services available yet
              </div>
            )}
          </div>
        </section>

        {/* Orders */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Clock className="w-6 h-6 text-primary" />
            Your Orders
          </h2>
          <div className="space-y-4">
            {orders.map((o) => (
              <div key={o.id} className={`glass rounded-xl p-6 ${o.status === 'pending' ? 'animate-pulse-glow' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {o.telegram_services?.name || "Service"}
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-lg text-foreground">{o.phone_number}</span>
                      <button
                        onClick={() => copyToClipboard(o.phone_number)}
                        className="text-primary hover:text-primary/80"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="text-right">
                    {o.status === "pending" && !o.otp && (
                      <div className="flex items-center gap-2 text-primary">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="font-medium animate-otp-blink">Waiting for OTP...</span>
                      </div>
                    )}
                    {o.otp && (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-3xl font-bold text-accent text-glow">{o.otp}</span>
                        <button
                          onClick={() => copyToClipboard(o.otp!)}
                          className="text-accent hover:text-accent/80"
                        >
                          <Copy className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {o.status === "completed" && (
                      <div className="flex items-center gap-1 text-accent mt-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span className="text-sm">Completed</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-12 text-muted-foreground glass rounded-xl">
                No orders yet. Buy a number to get started!
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Dashboard;
