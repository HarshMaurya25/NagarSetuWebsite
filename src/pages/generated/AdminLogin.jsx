import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  login,
  registerSupervisor,
  sendSupervisorRegistrationCode,
} from "../../services/api";
import { setSession } from "../../lib/session";

export default function AdminLogin() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const r = (params.get("role") || "").toLowerCase();
    return r === "supervisor" ? "supervisor" : "admin";
  }, [location.search]);
  const [mode, setMode] = useState("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [locationText, setLocationText] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isGmail = useMemo(() => {
    const value = (email || "").trim().toLowerCase();
    return value.endsWith("@gmail.com");
  }, [email]);

  const handleSendCode = async () => {
    setError("");
    setSuccess("");

    const trimmedEmail = (email || "").trim();
    if (!trimmedEmail) {
      setError("Please enter your Gmail address first.");
      return;
    }
    if (!isGmail) {
      setError("Please use a Gmail address (ends with @gmail.com).");
      return;
    }

    setSendingCode(true);
    try {
      await sendSupervisorRegistrationCode(trimmedEmail);
      setCodeSent(true);
      setSuccess("Verification code sent to your Gmail.");
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setSendingCode(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      if (mode === "register") {
        if (!codeSent) {
          throw new Error("Please send the verification code first.");
        }
        if (!code) {
          throw new Error("Please enter the verification code.");
        }
        const result = await registerSupervisor({
          fullName,
          phoneNumber,
          email,
          password,
          role: "SUPERVISOR",
          code,
          age: age ? Number(age) : undefined,
          gender,
          location: locationText,
        });

        if (result?.token) {
          setSession({
            token: result.token,
            user: {
              id: result?.id,
              email,
              fullName: fullName || "Supervisor",
              role: "SUPERVISOR",
            },
          });
          navigate("/supervisor/dashboard", { replace: true });
          return;
        }

        setSuccess(
          "Supervisor registration submitted successfully. You can login now.",
        );
        setMode("login");
        return;
      }

      const result = await login({ email, password, role });
      if (!result?.token) {
        throw new Error("Login response does not contain JWT token.");
      }

      setSession(result);
      navigate(
        role === "supervisor" ? "/supervisor/dashboard" : "/admin/dashboard",
        { replace: true },
      );
    } catch (err) {
      setError(err.message || "Unable to login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-surface flex items-center justify-center p-6">
      <section className="w-full max-w-md bg-surface-container-lowest border border-outline-variant/20 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={() => navigate("/public", { replace: true })}
            className="text-sm font-bold text-primary hover:underline"
          >
            Back to Home
          </button>
          <div className="text-xs text-on-surface-variant font-semibold">
            {role === "supervisor" ? "Supervisor" : "Admin"}
          </div>
        </div>

        <h1 className="text-3xl font-headline font-black text-primary mb-2">
          {role === "supervisor"
            ? mode === "register"
              ? "Supervisor Registration"
              : "Supervisor Login"
            : "Admin Login"}
        </h1>
        <p className="text-on-surface-variant mb-8">
          {mode === "register"
            ? "Register a new supervisor account for ward operations."
            : "Sign in with your backend account credentials."}
        </p>

        {role === "supervisor" && (
          <div className="mb-6 flex gap-2 rounded-xl bg-surface-container-low p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError("");
                setSuccess("");
                setCodeSent(false);
                setCode("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${mode === "login" ? "bg-primary text-white" : "text-on-surface-variant"}`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setError("");
                setSuccess("");
                setCodeSent(false);
                setCode("");
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold ${mode === "register" ? "bg-primary text-white" : "text-on-surface-variant"}`}
            >
              Register
            </button>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleLogin}>
          {mode === "register" && (
            <>
              <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
                <div>
                  <label
                    className="block text-sm font-bold mb-2"
                    htmlFor="email"
                  >
                    Gmail
                  </label>
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setCodeSent(false);
                      setCode("");
                    }}
                    className="w-full bg-surface-container-lowest px-4 py-3 rounded-xl border border-outline-variant/30"
                    placeholder="yourname@gmail.com"
                  />
                </div>
                <button
                  type="button"
                  className="w-full bg-primary text-white rounded-xl px-4 py-3 font-black disabled:opacity-50"
                  onClick={handleSendCode}
                  disabled={sendingCode || !email}
                >
                  {sendingCode
                    ? "Sending..."
                    : codeSent
                      ? "Resend Code"
                      : "Send Code"}
                </button>
              </div>

              {codeSent && (
                <div>
                  <label
                    className="block text-sm font-bold mb-2"
                    htmlFor="code"
                  >
                    Verification Code
                  </label>
                  <input
                    id="code"
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                    placeholder="Enter the code sent to Gmail"
                  />
                </div>
              )}

              <div>
                <label
                  className="block text-sm font-bold mb-2"
                  htmlFor="fullName"
                >
                  Full Name
                </label>
                <input
                  id="fullName"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                  placeholder="Supervisor name"
                />
              </div>
              <div>
                <label
                  className="block text-sm font-bold mb-2"
                  htmlFor="phoneNumber"
                >
                  Phone Number
                </label>
                <input
                  id="phoneNumber"
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                  placeholder="9876543210"
                />
              </div>
            </>
          )}

          {mode !== "register" && (
            <div>
              <label className="block text-sm font-bold mb-2" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                placeholder="you@example.com"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
              placeholder="********"
            />
          </div>

          {mode === "register" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold mb-2" htmlFor="age">
                    Age
                  </label>
                  <input
                    id="age"
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                    placeholder="30"
                  />
                </div>
                <div>
                  <label
                    className="block text-sm font-bold mb-2"
                    htmlFor="gender"
                  >
                    Gender
                  </label>
                  <input
                    id="gender"
                    type="text"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                    placeholder="Male / Female / Other"
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-bold mb-2"
                  htmlFor="location"
                >
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={locationText}
                  onChange={(e) => setLocationText(e.target.value)}
                  className="w-full bg-surface-container-low px-4 py-3 rounded-xl border border-outline-variant/30"
                  placeholder="Ward / Zone"
                />
              </div>

              {!codeSent && (
                <p className="text-xs text-on-surface-variant">
                  Send the code to Gmail first to continue.
                </p>
              )}
            </>
          )}

          {error && <p className="text-sm text-error font-medium">{error}</p>}
          {success && (
            <p className="text-sm text-primary font-medium">{success}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-60"
          >
            {loading
              ? mode === "register"
                ? "Registering..."
                : "Signing in..."
              : mode === "register"
                ? "Register Supervisor"
                : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
