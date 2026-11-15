import { findEmployee, mockEmployees } from "../data/employees";
import type { AuthAdapter, Employee } from "../types/auth";

const SESSION_KEY = "bark.demo.employee-id";

function delay(duration: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, duration));
}

export const mockAuthAdapter: AuthAdapter = {
  async restoreSession(): Promise<Employee | null> {
    const employeeId = window.localStorage.getItem(SESSION_KEY);
    return employeeId ? findEmployee(employeeId) ?? null : null;
  },

  async signIn(email: string): Promise<Employee> {
    await delay(450);
    const employee = mockEmployees.find((candidate) => candidate.email.toLowerCase() === email.toLowerCase());
    if (!employee || employee.accountStatus !== "active") {
      throw new Error("This demo employee is unavailable. Choose another employee and try again.");
    }
    window.localStorage.setItem(SESSION_KEY, employee.id);
    return employee;
  },

  async signOut(): Promise<void> {
    window.localStorage.removeItem(SESSION_KEY);
  },
};
