import { Routes, Route, Navigate } from 'react-router-dom';
import LibraryPage from './pages/LibraryPage';
import ImportPage from './pages/ImportPage';
import LearnPage from './pages/LearnPage';
import SingPage from './pages/SingPage';
import EditorPage from './pages/EditorPage';

function App() {
  return (
    <Routes>
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/import" element={<ImportPage />} />
      <Route path="/learn/:id" element={<LearnPage />} />
      <Route path="/sing/:id" element={<SingPage />} />
      <Route path="/editor/:id" element={<EditorPage />} />
      <Route path="/" element={<Navigate to="/library" replace />} />
    </Routes>
  );
}

export default App;








