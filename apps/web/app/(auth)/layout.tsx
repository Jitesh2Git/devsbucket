const AuthLayout = ({ children }: LayoutProps<"/">) => {
  return <div className="mx-auto w-full max-w-sm px-4 py-16">{children}</div>;
};

export default AuthLayout;
