import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Kerangka } from './components/Kerangka';
import { Monitoring } from './pages/Monitoring';
import { Detail } from './pages/Detail';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Kerangka />}>
          <Route index element={<Monitoring />} />
          <Route path="detail/:nomor" element={<Detail />} />
          <Route path="*" element={<Monitoring />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
