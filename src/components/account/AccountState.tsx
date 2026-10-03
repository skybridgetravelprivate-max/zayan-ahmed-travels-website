type AccountStateProps = {
  status: "empty" | "loading" | "error";
  title: string;
  message: string;
};

export function AccountState({ status, title, message }: AccountStateProps) {
  return (
    <section
      role={status === "error" ? "alert" : "status"}
      aria-busy={status === "loading" ? true : undefined}
      className="rounded-3xl border border-dashed border-line bg-surface px-6 py-10 text-center"
    >
      <h2 className="text-xl font-bold text-zayan-blue">{title}</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted">{message}</p>
    </section>
  );
}
