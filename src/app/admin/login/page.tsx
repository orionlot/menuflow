import LoginForm from "@/components/LoginForm";

export default function AdminLogin() {
  return (
    <LoginForm
      title="MenuFlow — Admin"
      redirectTo="/admin"
      hint="Demo: admin@menuflow.it / menuflow-admin"
    />
  );
}
