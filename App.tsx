import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import Login from "./pages/Login"
import NotFound from "./pages/NotFound"
import Dashboard from "./pages/portal/Dashboard"
import Tasks from "./pages/portal/Tasks"
import Projects from "./pages/portal/Projects"
import Documents from "./pages/portal/Documents"
import Users from "./pages/portal/Users"
import Logs from "./pages/portal/Logs"
import SiteEditor from "./pages/portal/SiteEditor"

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/portal" element={<Dashboard />} />
      <Route path="/portal/tasks" element={<Tasks />} />
      <Route path="/portal/projects" element={<Projects />} />
      <Route path="/portal/documents" element={<Documents />} />
      <Route path="/portal/users" element={<Users />} />
      <Route path="/portal/logs" element={<Logs />} />
      <Route path="/portal/site" element={<SiteEditor />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
