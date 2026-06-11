import LoginForm from "@/components/LoginForm";

export default function DashboardLogin() {
  return (
    <LoginForm
      title="Dashboard ristoratore"
      redirectTo="/dashboard"
      hint="Demo: mario@pizzeria.it / pizzeria-mario · luna@barluna.it / bar-luna"
    />
  );
}
