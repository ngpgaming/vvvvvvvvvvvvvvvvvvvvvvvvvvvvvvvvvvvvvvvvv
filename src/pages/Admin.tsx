import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageSquare, ArrowLeft, Plus, Trash2, Send, Phone, Package, Users, Hash
} from "lucide-react";

interface Service {
  id: string;
  name: string;
  price: number;
  is_active: boolean;
  numbers: { id: string; phone_number: string; is_sold: boolean }[];
}

interface Order {
  id: string;
  phone_number: string;
  otp: string | null;
  status: string;
  created_at: string;
  profiles: { email: string } | null;
  telegram_services: { name: string } | null;
}

const Admin = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [services, setServices] = useState<Service[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newServiceName, setNewServiceName] = useState("");
  const [newServicePrice, setNewServicePrice] = useState("");
  const [addingNumbers, setAddingNumbers] = useState<Record<string, string>>({});
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard");
      return;
    }
    fetchAll();
  }, [isAdmin]);

  const fetchAll = async () => {
    // Fetch services with numbers
    const { data: servicesData } = await supabase
      .from("telegram_services")
      .select("id, name, price, is_active")
      .order("created_at", { ascending: false });

    if (servicesData) {
      const withNumbers = await Promise.all(
        servicesData.map(async (s) => {
          const { data: nums } = await supabase
            .from("phone_numbers")
            .select("id, phone_number, is_sold")
            .eq("service_id", s.id);
          return { ...s, numbers: nums || [] };
        })
      );
      setServices(withNumbers);
    }

    // Fetch pending orders
    const { data: ordersData } = await supabase
      .from("orders")
      .select("id, phone_number, otp, status, created_at, telegram_services(name)")
      .order("created_at", { ascending: false })
      .limit(50);
    if (ordersData) setOrders(ordersData as any);
  };

  const addService = async () => {
    if (!newServiceName.trim()) return;
    const { error } = await supabase.from("telegram_services").insert({
      name: newServiceName.trim(),
      price: parseFloat(newServicePrice) || 0,
    });
    if (error) { toast.error("Failed to add service"); return; }
    toast.success("Service added!");
    setNewServiceName("");
    setNewServicePrice("");
    fetchAll();
  };

  const addNumbers = async (serviceId: string) => {
    const numbersText = addingNumbers[serviceId];
    if (!numbersText?.trim()) return;
    
    const numbers = numbersText.split("\n").map(n => n.trim()).filter(Boolean);
    const inserts = numbers.map(phone_number => ({
      service_id: serviceId,
      phone_number,
    }));

    const { error } = await supabase.from("phone_numbers").insert(inserts);
    if (error) { toast.error("Failed to add numbers"); return; }
    toast.success(`${numbers.length} numbers added!`);
    setAddingNumbers(prev => ({ ...prev, [serviceId]: "" }));
    fetchAll();
  };

  const sendOtp = async (orderId: string) => {
    const otp = otpInputs[orderId];
    if (!otp?.trim()) return;

    const { error } = await supabase
      .from("orders")
      .update({ otp: otp.trim(), status: "completed", completed_at: new Date().toISOString() })
      .eq("id", orderId);
    
    if (error) { toast.error("Failed to send OTP"); return; }

    // Mark number as sold
    const order = orders.find(o => o.id === orderId);
    if (order) {
      await supabase
        .from("phone_numbers")
        .update({ is_sold: true })
        .eq("phone_number", order.phone_number);
    }

    toast.success("OTP sent to user!");
    setOtpInputs(prev => ({ ...prev, [orderId]: "" }));
    fetchAll();
  };

  const deleteNumber = async (numberId: string) => {
    await supabase.from("phone_numbers").delete().eq("id", numberId);
    toast.success("Number deleted");
    fetchAll();
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
            <span className="text-xs px-2 py-1 rounded-full bg-destructive/20 text-destructive border border-destructive/30">ADMIN</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
          </Button>
        </div>
      </nav>

      <div className="container mx-auto px-4 py-8 space-y-10">
        {/* Add Service */}
        <section className="glass rounded-xl p-6">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" /> Add New Service
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              value={newServiceName}
              onChange={(e) => setNewServiceName(e.target.value)}
              placeholder="Service name (e.g., Telegram India)"
              className="bg-muted/50 border-border/50 flex-1"
            />
            <Input
              type="number"
              value={newServicePrice}
              onChange={(e) => setNewServicePrice(e.target.value)}
              placeholder="Price (₹)"
              className="bg-muted/50 border-border/50 w-32"
            />
            <Button onClick={addService} className="bg-primary text-primary-foreground glow-primary">
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </section>

        {/* Services & Numbers */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" /> Services & Numbers
          </h2>
          <div className="space-y-4">
            {services.map((s) => {
              const available = s.numbers.filter(n => !n.is_sold).length;
              const sold = s.numbers.filter(n => n.is_sold).length;
              return (
                <div key={s.id} className="glass rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">{s.name}</h3>
                      <p className="text-sm text-muted-foreground">₹{s.price}</p>
                    </div>
                    <div className="text-right text-sm">
                      <p className="text-accent">Available: {available}</p>
                      <p className="text-muted-foreground">Sold: {sold}</p>
                    </div>
                  </div>

                  {/* Numbers list */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {s.numbers.map((n) => (
                      <div
                        key={n.id}
                        className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-sm font-mono ${
                          n.is_sold
                            ? "bg-destructive/10 text-destructive/70 border border-destructive/20"
                            : "bg-accent/10 text-accent border border-accent/20"
                        }`}
                      >
                        <Phone className="w-3 h-3" />
                        {n.phone_number}
                        {!n.is_sold && (
                          <button onClick={() => deleteNumber(n.id)} className="ml-1 hover:text-destructive">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Add numbers */}
                  <div className="flex gap-2">
                    <textarea
                      value={addingNumbers[s.id] || ""}
                      onChange={(e) => setAddingNumbers(prev => ({ ...prev, [s.id]: e.target.value }))}
                      placeholder="Enter numbers (one per line)"
                      rows={2}
                      className="flex-1 bg-muted/50 border border-border/50 rounded-lg p-3 text-sm font-mono text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:border-primary"
                    />
                    <Button
                      onClick={() => addNumbers(s.id)}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Hash className="w-4 h-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Orders - Send OTP */}
        <section>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> Orders (Send OTP)
          </h2>
          <div className="space-y-3">
            {orders.map((o) => (
              <div key={o.id} className={`glass rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${o.status === 'pending' ? 'border-primary/30' : 'border-border/30'}`}>
                <div>
                  <p className="text-sm text-muted-foreground">{o.telegram_services?.name}</p>
                  <p className="font-mono text-foreground">{o.phone_number}</p>
                  <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-2">
                  {o.status === "pending" ? (
                    <>
                      <Input
                        value={otpInputs[o.id] || ""}
                        onChange={(e) => setOtpInputs(prev => ({ ...prev, [o.id]: e.target.value }))}
                        placeholder="Enter OTP"
                        className="bg-muted/50 border-border/50 w-40 font-mono"
                      />
                      <Button
                        onClick={() => sendOtp(o.id)}
                        size="sm"
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        <Send className="w-4 h-4 mr-1" /> Send
                      </Button>
                    </>
                  ) : (
                    <span className="text-sm text-accent font-mono">OTP: {o.otp} ✓</span>
                  )}
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="text-center py-8 text-muted-foreground glass rounded-xl">No orders yet</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Admin;
