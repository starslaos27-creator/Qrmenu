import {r as React} from './vendor-react-DCUvmuBu.js';

// Retire old page URLs without deleting stock records or changing API behavior.
export function StockPageRedirect({to}) {
  React.useEffect(() => { window.location.replace(to); }, [to]);
  return null;
}
