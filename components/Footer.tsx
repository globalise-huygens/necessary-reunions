export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="hidden sm:block bg-muted text-muted-foreground border-t border-border py-2 text-center text-[10px]">
      <p>© {year} Necessary Reunions. Funded by NWO OC XS.</p>
    </footer>
  );
}
