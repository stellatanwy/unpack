import "./styles/global.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import QuestionBankAdmin from "./admin/QuestionBankAdmin.jsx";
import QuestionPreview from "./admin/QuestionPreview.jsx";
import StaticPage from "./StaticPage.jsx";

const path = window.location.pathname;

const root =
  path === '/admin'   ? <QuestionBankAdmin /> :
  path === '/preview' ? <QuestionPreview /> :
  path === '/privacy' ? <StaticPage page="privacy" /> :
  path === '/terms'   ? <StaticPage page="terms" /> :
  <App />;

createRoot(document.getElementById("root")).render(
  <StrictMode>{root}</StrictMode>
);
