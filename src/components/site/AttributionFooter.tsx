/**
 * Site-wide credit shown on every page. MIT still requires the LICENSE file;
 * this footer is the visible attribution the mosque agrees to keep.
 *
 * @author Muhammad Naheen Mahboob
 * @author Mashrur Khandaker
 */

export function AttributionFooter() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-center text-xs leading-relaxed text-slate-500">
      <p>
        Developed by Muhammad Naheen Mahboob and Mashrur Khandaker for London
        Muslim Mosque (London, Ontario). © 2026. MIT License.
      </p>
    </footer>
  );
}
