import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function HomeIndex() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate("/environment", { replace: true });
  }, [navigate]);
  return null;
}
