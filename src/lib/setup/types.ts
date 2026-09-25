/* Shapes shared by the setup page and the /api/setup routes. */

export type AppRoleKey = "admin" | "csr" | "sales_rep" | "installer";

export interface SetupCredential {
  token: string;
  locationId: string;
}

export interface SetupGhlUser {
  ghlUserId: string;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  /** "agency:admin", "agency:user", "account:admin", "account:user" */
  ghlRole: string;
}

export interface SetupStatusResponse {
  completed: boolean;
  /** False when SETUP_KEY is missing from the server's environment. */
  keyConfigured: boolean;
}

export interface SetupVerifyResponse {
  location: { id: string; name: string };
  users: SetupGhlUser[];
  /** The agency owner: fixed as the app Admin. Null when setup could not tell who it is. */
  ownerGhlUserId: string | null;
  ownerDetectedBy: "company_email" | "location_email" | "only_agency_admin" | null;
}

export interface SetupCreatedUser {
  name: string;
  email: string;
  role: AppRoleKey;
  ghlRole: string;
  ghlUserId: string;
  temporaryPassword: string;
}

export interface SetupCompleteResponse {
  location: { id: string; name: string };
  created: SetupCreatedUser[];
  loginUrl: string;
  backupFile: string | null;
}
