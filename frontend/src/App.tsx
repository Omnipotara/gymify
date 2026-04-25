import { Routes, Route } from 'react-router-dom';

// Pages are added here as each slice feature is built
export default function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <div className="flex min-h-screen items-center justify-center text-gray-500">
            Gymify — coming soon
          </div>
        }
      />
    </Routes>
  );
}
