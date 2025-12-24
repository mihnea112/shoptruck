export function MainFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-6 text-sm text-slate-500 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="font-medium text-slate-600">
            © {new Date().getFullYear()} AutoTruck · ShopTruck.ro
          </p>
          <p className="text-xs text-slate-400">
            Piese pentru camioane, direct de la specialiști în transport.
          </p>
        </div>
      </div>
    </footer>
  );
}