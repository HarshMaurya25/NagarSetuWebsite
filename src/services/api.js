import { get, post, put, del, request } from "../lib/http";
import { ML_API_BASE } from "../config/env";
import { getUser } from "../lib/session";

function toStageLabel(stage) {
  return (stage || "").replaceAll("_", " ");
}

function makeQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value));
    }
  });
  return query.toString();
}

function pickFirst(source, keys = []) {
  if (!source) return null;
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

async function requestWithSupervisorFallback(requestFn, url, ...args) {
  if (!url.includes("/supervisor")) {
    return requestFn(url, ...args);
  }

  const fallbackUrl = url.replace("/supervisor", "/supervisior");
  try {
    return await requestFn(url, ...args);
  } catch (err) {
    if (fallbackUrl === url) throw err;
    return requestFn(fallbackUrl, ...args);
  }
}

export function resolveIssueEvidence(issue = {}, detail = null) {
  const merged = { ...(issue || {}), ...(detail || {}) };
  const previousImageUrl = pickFirst(merged, [
    "previousImageUrl",
    "beforeImageUrl",
    "preImageUrl",
    "oldImageUrl",
    "reportedImageUrl",
    "imageBeforeUrl",
    "initialImageUrl",
    "initialIssueImage",
  ]);
  const resolvedImageUrl = pickFirst(merged, [
    "resolvedImageUrl",
    "resolveImageUrl",
    "afterImageUrl",
    "postImageUrl",
    "newImageUrl",
    "imageAfterUrl",
    "completionImageUrl",
    "evidenceImageUrl",
  ]);
  const imageUrl = pickFirst(merged, ["imageUrl", "issueImageUrl", "photoUrl"]);

  return {
    previousImageUrl: previousImageUrl || imageUrl || null,
    resolvedImageUrl: resolvedImageUrl || imageUrl || null,
    imageUrl: imageUrl || resolvedImageUrl || previousImageUrl || null,
  };
}

export async function login({ email, password, role }) {
  const roleKey = String(role || "")
    .trim()
    .toLowerCase();
  const normalizedRole =
    roleKey === "supervisor" || roleKey === "supervisior"
      ? "SUPERVISOR"
      : roleKey === "worker"
        ? "WORKER"
        : "ADMIN";
  const endpoint =
    normalizedRole === "SUPERVISOR"
      ? "/api/supervisor/login"
      : normalizedRole === "WORKER"
        ? "/api/worker/login"
        : "/api/authenication/login";
  const payload =
    normalizedRole === "SUPERVISOR"
      ? await requestWithSupervisorFallback(post, endpoint, {
          email,
          password,
        })
      : await post(endpoint, { email, password });

  const sessionUser = {
    id: payload?.id,
    email: payload?.email || email,
    fullName: payload?.fullName || "NagarSetu User",
    role: normalizedRole,
  };

  return {
    token: payload?.token,
    user: sessionUser,
  };
}

export function registerSupervisor(payload) {
  return requestWithSupervisorFallback(
    post,
    "/api/supervisor/registration",
    payload,
  );
}

export async function sendSupervisorRegistrationCode(email) {
  const query = makeQuery({ email, roles: "supervisor" });
  return requestWithSupervisorFallback(get, `/api/supervisor/getCode?${query}`);
}

export function getUserProfile(userId) {
  return get(`/api/user/get?id=${userId}`);
}

export function getUserMatrix(userId) {
  return get(`/api/user/getMatrix?id=${userId}`);
}

export function getUserLeaderboard() {
  return get("/api/user/getLeaderboard");
}

export function getAdminStatsOverview() {
  return get("/api/admin/stats/overview");
}

export function getSolvedIssues(page = 0, size = 3) {
  return get(`/api/issue/solved?page=${page}&size=${size}`);
}

export async function getPublicLandingData(userId) {
  const requests = [
    getUserLeaderboard(),
    get("/api/issue/recent?page=0&size=1").catch(() => null),
    getSolvedIssues(0, 1).catch(() => null),
    getTopWards().catch(() => []),
  ];
  requests.push(
    userId ? getUserMatrix(userId).catch(() => null) : Promise.resolve(null),
  );

  const [leaderboard, recentIssuePage, solvedIssuePage, topWards, userMatrix] =
    await Promise.all(requests);

  const overview = {
    totalIssuesReported: recentIssuePage?.totalElements ?? 0,
    totalIssuesResolved: solvedIssuePage?.totalElements ?? 0,
    monthlyReportedIssues: 0,
    monthlySolvedIssues: 0,
    workerCount: 0,
    supervisorCount: 0,
  };

  const solvedRows = solvedIssuePage?.content || [];
  const solvedWithEvidence = await Promise.all(
    solvedRows.map(async (issue) => {
      const detail = await getIssueDetail(issue.id).catch(() => null);
      const evidence = resolveIssueEvidence(issue, detail);
      return {
        ...issue,
        ...(detail || {}),
        ...evidence,
      };
    }),
  );

  return {
    leaderboard: Array.isArray(leaderboard) ? leaderboard : [],
    adminMatrix: null,
    overview,
    solvedIssues: Array.isArray(solvedWithEvidence) ? solvedWithEvidence : [],
    userMatrix,
    topWards: Array.isArray(topWards) ? topWards : [],
  };
}

export async function getAdminDashboard() {
  const [
    issueMatrix,
    workers,
    supervisors,
    recent,
    weeklyStages,
    leaderboard,
    stageMatrix,
    wardMatrix,
    slaBreaches,
  ] = await Promise.all([
    getAdminIssueMatrix(),
    get("/api/admin/workers"),
    get("/api/admin/supervisors"),
    get("/api/issue/recent?page=0&size=6"),
    get("/api/issue/stats/weekly/stages"),
    getUserLeaderboard().catch(() => []),
    getAdminMatrixStages({ days: 7 }).catch(() => []),
    getAdminMatrixWards({ days: 30 }).catch(() => []),
    getAdminMatrixSlaBreaches({ days: 30 }).catch(() => null),
  ]);

  return {
    issueMatrix,
    workers,
    supervisors,
    recent: recent?.content || [],
    weeklyStages: weeklyStages || [],
    leaderboard,
    stageMatrix: stageMatrix || [],
    wardMatrix: wardMatrix || [],
    slaBreaches,
  };
}

export function getAdminIssueMatrix(wardId) {
  const query = makeQuery({ wardId });
  return get(`/api/admin/issues/stats/matrix${query ? `?${query}` : ""}`);
}

export function getAdminMatrixStages({ days = 7, wardId } = {}) {
  const query = makeQuery({ days, wardId });
  return get(
    `/api/admin/issues/stats/matrix/stages${query ? `?${query}` : ""}`,
  );
}

export function getAdminMatrixWards({ days = 30 } = {}) {
  const query = makeQuery({ days });
  return get(`/api/admin/issues/stats/matrix/wards${query ? `?${query}` : ""}`);
}

export function getAdminMatrixSlaBreaches({ days = 30, wardId } = {}) {
  const query = makeQuery({ days, wardId });
  return get(
    `/api/admin/issues/stats/matrix/sla-breaches${query ? `?${query}` : ""}`,
  );
}

export function getAdminCitizenDetail(userId) {
  return get(`/api/admin/users/citizens/${userId}/detail`);
}

export function getAdminWorkerDetail(workerId) {
  return get(`/api/admin/users/workers/${workerId}/detail`);
}

// Role-agnostic worker profile fetch (supervisor/worker-friendly where supported)
export async function getWorkerDetail(workerId) {
  if (!workerId) return null;
  const id = encodeURIComponent(String(workerId));

  const candidates = [
    `/api/admin/users/workers/${id}/detail`,
    `/api/worker/${id}/detail`,
    `/api/worker/${id}`,
  ];

  for (const url of candidates) {
    try {
      return await get(url);
    } catch {
      // try next candidate
    }
  }

  return null;
}

export function getAdminSupervisorDetail(supervisorId) {
  return get(`/api/admin/users/supervisors/${supervisorId}/detail`);
}

export function getIssueDetail(issueId) {
  return get(`/api/issue/${issueId}`);
}

export function getAdminMapIssues() {
  return get("/api/issue/map/admin");
}

export function getWardDetail(wardId, wardName) {
  const query = wardId ? makeQuery({ wardId }) : makeQuery({ wardName });
  return get(`/api/admin/wards/detail${query ? `?${query}` : ""}`);
}

export function uploadWardGeoJson(payload) {
  return post("/api/wards/upload", payload);
}

export async function getAdminAnalytics() {
  const [thirtyDays, leaderboard, stageMatrix, wardMatrix, slaBreaches] =
    await Promise.all([
      get("/api/admin/issues/stats/30days"),
      get("/api/user/getLeaderboard"),
      getAdminMatrixStages({ days: 7 }).catch(() => []),
      getAdminMatrixWards({ days: 30 }).catch(() => []),
      getAdminMatrixSlaBreaches({ days: 30 }).catch(() => null),
    ]);

  return {
    thirtyDays,
    leaderboard,
    stageMatrix: stageMatrix || [],
    wardMatrix: wardMatrix || [],
    slaBreaches,
  };
}

export async function getAdminIssueList(page = 0, size = 10) {
  const recent = await get(`/api/issue/recent?page=${page}&size=${size}`);
  const base = recent?.content || [];

  const details = await Promise.all(
    base.map(async (item) => {
      try {
        const [full, worker] = await Promise.all([
          get(`/api/issue/${item.id}`),
          get(`/api/issue/${item.id}/worker`).catch(() => null),
        ]);

        return {
          id: item.id,
          title: full?.title || item.title,
          issueType: full?.issueType || "OTHER",
          location: full?.location || "N/A",
          criticality: full?.criticality || "LOW",
          stage: full?.stages || item.stages,
          submittedAt: full?.createAt || item.createdAt,
          image: full?.imageUrl || item.imageUrl || null,
          assignedTo: worker?.workerName || "Unassigned",
        };
      } catch {
        return {
          id: item.id,
          title: item.title,
          issueType: "OTHER",
          location: "N/A",
          criticality: "LOW",
          stage: item.stages,
          submittedAt: item.createdAt,
          image: item.imageUrl,
          assignedTo: "Unassigned",
        };
      }
    }),
  );

  return {
    totalElements: recent?.totalElements || details.length,
    totalPages: recent?.totalPages || 1,
    pageNumber: recent?.number || 0,
    content: details.map((it) => ({
      ...it,
      stageLabel: toStageLabel(it.stage),
    })),
  };
}

export async function getAdminWorkforce() {
  const [supervisors, workers, workersNoStart, supervisorsNoStart] =
    await Promise.all([
      get("/api/admin/supervisors"),
      get("/api/admin/workers"),
      get("/api/admin/workers/no-start"),
      get("/api/admin/supervisors/no-start"),
    ]);

  return {
    supervisors,
    workers,
    workersNoStart,
    supervisorsNoStart,
  };
}

export async function getAdminWards() {
  const [wards, geojson] = await Promise.all([
    get("/api/admin/wards").catch(() => []),
    get("/api/wards/geojson").catch(() => ({})),
  ]);

  return {
    wards,
    geojson,
  };
}

export async function allocateWardToSupervisor(wardId, supervisorId) {
  return requestWithSupervisorFallback(
    put,
    `/api/admin/wards/${wardId}/supervisor/${supervisorId}`,
    {},
  );
}

export async function reassignWorker(workerId, supervisorId) {
  return put(`/api/admin/reassignWorker/${workerId}/${supervisorId}`, {});
}

export async function reassignIssueWorker(issueId, workerId) {
  return put(`/api/admin/reassignIssueWorker/${issueId}/${workerId}`, {});
}
export async function getTopWards() {
  // New endpoint (requested): /api/performance/wards/top
  // Keep a fallback to the older endpoint if needed.
  try {
    const res = await get("/api/performance/wards/top");
    return Array.isArray(res) ? res : [];
  } catch {
    const fallback = await get("/api/performance/top-wards").catch(() => []);
    return Array.isArray(fallback) ? fallback : [];
  }
}
export function deleteWard(wardName) {
  return del(`/api/wards/name/${encodeURIComponent(wardName)}`);
}
export async function deleteSupervisor(supervisorId) {
  return del(`/api/admin/supervisors/${supervisorId}`);
}

export async function getSupervisorDashboard(supervisorId) {
  const [
    matrix,
    workersResponse,
    recent,
    wardMatrix,
    stageMatrix,
    slaBreaches,
  ] = await Promise.all([
    requestWithSupervisorFallback(
      get,
      `/api/supervisor/issues/stats/matrix?supervisorId=${supervisorId}`,
    ).catch(() => null),
    requestWithSupervisorFallback(
      get,
      `/api/supervisor/${supervisorId}/workers`,
    ).catch(() => []),
    get("/api/issue/recent?page=0&size=8"),
    getSupervisorMatrixWards({ supervisorId, days: 30 }).catch(
      () => [],
    ),
    getSupervisorMatrixStages({ supervisorId, days: 7 }).catch(
      () => [],
    ),
    getSupervisorMatrixSlaBreaches({
      supervisorId,
      days: 30,
    }).catch(() => null),
  ]);

  const workersRaw = Array.isArray(workersResponse)
    ? workersResponse
    : workersResponse?.workers || workersResponse?.content || [];
  const workers = (workersRaw || []).map(normalizeSupervisorWorker);

  const assignedWardId = matrix?.wardId || wardMatrix?.[0]?.wardId;

  const mapIssues = assignedWardId
    ? await getSupervisorMapIssues(assignedWardId).catch(() => [])
    : [];

  return {
    matrix,
    workers,
    mapIssues,
    recent: recent?.content || [],
    wardMatrix: wardMatrix || [],
    stageMatrix: stageMatrix || [],
    slaBreaches,
  };
}

export function getSupervisorIssueMatrix(supervisorId, wardId) {
  const query = makeQuery({ supervisorId, wardId });
  return requestWithSupervisorFallback(
    get,
    `/api/supervisor/issues/stats/matrix?${query}`,
  );
}

export function getSupervisorMatrixWards({
  supervisorId,
  days = 30,
} = {}) {
  const sid = supervisorId;
  const query = makeQuery({ supervisorId: sid, days });
  return requestWithSupervisorFallback(
    get,
    `/api/supervisor/issues/stats/matrix/wards?${query}`,
  );
}

export function getSupervisorMatrixStages({
  supervisorId,
  days = 7,
} = {}) {
  const sid = supervisorId;
  const query = makeQuery({ supervisorId: sid, days });
  return requestWithSupervisorFallback(
    get,
    `/api/supervisor/issues/stats/matrix/stages?${query}`,
  );
}

export function getSupervisorMatrixSlaBreaches({
  supervisorId,
  days = 30,
} = {}) {
  const sid = supervisorId;
  const query = makeQuery({ supervisorId: sid, days });
  return requestWithSupervisorFallback(
    get,
    `/api/supervisor/issues/stats/matrix/sla-breaches?${query}`,
  );
}

export function getSupervisorMapIssues(wardId) {
  return requestWithSupervisorFallback(
    get,
    `/api/issue/map/supervisor?wardId=${wardId}`,
  );
}

function mapStageToSupervisorStatus(stage) {
  const normalized = String(stage || "").toUpperCase();
  if (normalized === "IN_PROGRESS") return "IN_PROGRESS";
  if (normalized === "RESOLVED") return "RESOLVED";
  return "OPEN";
}

function normalizeSupervisorIssue(issue = {}) {
  const lat = Number(issue.latitude ?? issue.lat ?? issue.locationLat);
  const lng = Number(issue.longitude ?? issue.lng ?? issue.locationLng);
  return {
    id: issue.id,
    title: issue.title || "Untitled Issue",
    description: issue.description || "",
    wardId: issue.wardId || issue.ward?.id || "",
    wardName: issue.wardName || issue.ward?.name || issue.ward || "N/A",
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    status: issue.status || mapStageToSupervisorStatus(issue.stages),
    stages: issue.stages || "",
    createdAt: issue.createdAt || issue.createAt || "",
    criticality: issue.criticality || "LOW",
    issueType: issue.issueType || "OTHER",
  };
}

function normalizeSupervisorWorker(worker = {}) {
  const id =
    worker.id ??
    worker.workerId ??
    worker.userId ??
    worker.worker?.id ??
    worker.worker?.workerId;

  const fullName =
    worker.fullName ??
    worker.workerName ??
    worker.username ??
    worker.name ??
    worker.worker?.fullName ??
    worker.worker?.username;

  const issueCountRaw =
    worker.issueCount ??
    worker.assignedIssuesCount ??
    worker.issuesCount ??
    worker.totalIssues ??
    (Array.isArray(worker.issues) ? worker.issues.length : undefined);

  const issueCount = Number.isFinite(Number(issueCountRaw))
    ? Number(issueCountRaw)
    : 0;

  return {
    ...worker,
    id,
    fullName,
    issueCount,
  };
}

export async function getSupervisorIssues({
  supervisorId,
  wardId,
  status,
} = {}) {
  const sid = supervisorId;
  const [matrix, wardMatrix] = await Promise.all([
    getSupervisorIssueMatrix(sid, wardId).catch(() => null),
    getSupervisorMatrixWards({ supervisorId: sid, days: 30 }).catch(() => []),
  ]);
  const resolvedWardId = wardId || matrix?.wardId || wardMatrix?.[0]?.wardId;

  if (!resolvedWardId) {
    return {
      matrix,
      wardId: "",
      issues: [],
      wards: [],
    };
  }

  // Try dedicated endpoint first.
  const query = makeQuery({ supervisorId: sid, wardId: resolvedWardId });
  const direct = await requestWithSupervisorFallback(
    get,
    `/api/supervisor/issues${query ? `?${query}` : ""}`,
  ).catch((err) => {
    console.warn(
      "Direct issues fetch failed, falling back to map hydrate",
      err,
    );
    return null;
  });

  let issueRows = [];
  if (Array.isArray(direct)) {
    issueRows = direct;
  } else if (Array.isArray(direct?.content)) {
    issueRows = direct.content;
  } else {
    // Fallback to map endpoint and hydrate details.
    const mapRows = await getSupervisorMapIssues(resolvedWardId).catch(
      () => [],
    );
    issueRows = await Promise.all(
      (mapRows || []).map(async (row) => {
        const detail = await getIssueDetail(row.id).catch(() => null);
        return { ...row, ...(detail || {}) };
      }),
    );
  }

  const normalized = issueRows.map(normalizeSupervisorIssue);
  const filteredByStatus = status
    ? normalized.filter((item) => item.status === status)
    : normalized;

  return {
    matrix,
    wardId: resolvedWardId,
    issues: filteredByStatus,
    wards: [
      {
        wardId: resolvedWardId,
        wardName:
          matrix?.wardName ||
          matrix?.name ||
          wardMatrix?.[0]?.wardName ||
          "Assigned Ward",
      },
    ],
  };
}

export async function getWorkerAssignedIssues(workerId) {
  if (!workerId) return [];
  const id = encodeURIComponent(String(workerId));

  const normalize = (value) => {
    if (Array.isArray(value)) return value;
    if (Array.isArray(value?.content)) return value.content;
    if (Array.isArray(value?.issues)) return value.issues;
    if (Array.isArray(value?.items)) return value.items;
    return [];
  };

  const candidates = [
    `/api/admin/worker/${id}/issues`,
    `/api/worker/${id}/issues`,
    `/api/worker/issues?workerId=${id}`,
  ];

  for (const url of candidates) {
    try {
      const res = await get(url);
      return normalize(res);
    } catch {
      // try next candidate
    }
  }

  return [];
}

export async function getWardRecentIssues(wardId) {
  if (!wardId) return [];
  const mapIssues = await requestWithSupervisorFallback(
    get,
    `/api/issue/map/supervisor?wardId=${wardId}`,
  ).catch(() => []);
  const rows = Array.isArray(mapIssues) ? mapIssues : [];
  const enriched = await Promise.all(
    rows.slice(0, 8).map(async (row) => {
      try {
        const detail = await getIssueDetail(row.id);
        const evidence = resolveIssueEvidence(row, detail);
        return {
          id: row.id,
          title: detail?.title || "Untitled",
          issueType: detail?.issueType || row.issueType || "OTHER",
          ...evidence,
          createdAt: detail?.createAt || detail?.createdAt || "",
          criticality: detail?.criticality || row.criticality || "LOW",
          stages: detail?.stages || row.stages || "",
        };
      } catch {
        return {
          id: row.id,
          title: "Untitled",
          issueType: row.issueType || "OTHER",
          imageUrl: null,
          createdAt: "",
          criticality: row.criticality || "LOW",
          stages: row.stages || "",
        };
      }
    }),
  );
  return enriched;
}

export async function getSupervisorMap(supervisorId) {
  const [matrix, workersResponse] = await Promise.all([
    getSupervisorIssueMatrix(supervisorId),
    requestWithSupervisorFallback(
      get,
      `/api/supervisor/${supervisorId}/workers`,
    ).catch(() => []),
  ]);

  const workersRaw = Array.isArray(workersResponse)
    ? workersResponse
    : workersResponse?.workers || workersResponse?.content || [];
  const workers = (workersRaw || []).map(normalizeSupervisorWorker);

  const issues = matrix?.wardId
    ? await getSupervisorMapIssues(matrix.wardId).catch(() => [])
    : [];

  return { workers, issues, matrix };
}

export async function loginAnyRole({ email, password, role }) {
  const normalizedRole = String(role || "")
    .trim()
    .toUpperCase();
  const endpointCandidates =
    normalizedRole === "SUPERVISOR"
      ? ["/api/supervisor/login", "/api/supervisior/login"]
      : normalizedRole === "WORKER"
        ? ["/api/worker/login"]
        : normalizedRole === "CITIZEN" || normalizedRole === "USER"
          ? [
              "/api/authenication/login",
              "/api/authentication/login",
              "/api/user/login",
              "/api/citizen/login",
            ]
          : [
              "/api/authenication/login",
              "/api/authentication/login",
              "/api/admin/login",
            ];

  let lastError = null;
  for (const endpoint of endpointCandidates) {
    try {
      const payload = await post(endpoint, { email, password });
      const token =
        payload?.token ||
        payload?.accessToken ||
        payload?.jwt ||
        payload?.data?.token ||
        payload?.data?.accessToken;

      if (!token) {
        throw new Error("Login response does not contain JWT token.");
      }

      const userFromPayload = payload?.user || payload?.data?.user || payload;
      const rawRole = String(
        userFromPayload?.role || normalizedRole || "ADMIN",
      ).toUpperCase();
      const sessionUser = {
        id: userFromPayload?.id || userFromPayload?.userId || payload?.id,
        email: userFromPayload?.email || email,
        fullName:
          userFromPayload?.fullName ||
          userFromPayload?.name ||
          userFromPayload?.username ||
          "NagarSetu User",
        role: rawRole === "SUPERVISIOR" ? "SUPERVISOR" : rawRole,
      };

      return { token, user: sessionUser };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Login failed.");
}

export async function createIssue(formData) {
  if (!(formData instanceof FormData)) {
    throw new Error("createIssue expects a FormData payload.");
  }

  const candidates = [
    "/api/issue/create",
    "/api/issue/report",
    "/api/issue",
    "/api/user/issue",
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      return await request(url, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to create issue.");
}

export async function getNearbyIssues(lat, lng, radiusKm = 1) {
  const candidates = [
    `/api/issue/nearby?${makeQuery({ lat, lng, radius: radiusKm })}`,
    `/api/issue/nearby?${makeQuery({ latitude: lat, longitude: lng, radius: radiusKm })}`,
    `/api/issue/nearby?${makeQuery({ latitude: lat, longitude: lng, radiusKm })}`,
    `/api/issue/nearBy?${makeQuery({ lat, lng, radius: radiusKm })}`,
    `/api/issue/near?${makeQuery({ lat, lng, radius: radiusKm })}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      return await get(url);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to load nearby issues.");
}

export async function getUserIssues(userId) {
  if (!userId) return [];
  const id = encodeURIComponent(String(userId));

  const candidates = [
    `/api/user/${id}/issues`,
    `/api/user/issues?${makeQuery({ userId: id })}`,
    `/api/issue/user?${makeQuery({ userId: id })}`,
    `/api/issue/by-user?${makeQuery({ userId: id })}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      const res = await get(url);
      if (Array.isArray(res)) return res;
      if (Array.isArray(res?.content)) return res.content;
      if (Array.isArray(res?.issues)) return res.issues;
      return [];
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to load user issues.");
}

export async function acceptIssue(issueId) {
  if (!issueId) throw new Error("Issue id is required.");
  const id = encodeURIComponent(String(issueId));
  const user = getUser();
  const workerId = user?.id;
  const query = workerId ? `?workerId=${encodeURIComponent(workerId)}` : "";

  const candidates = [
    `/api/worker/issues/${id}/start${query}`,
    `/api/worker/issues/${id}/start`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      return await put(url, {});
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to accept issue.");
}

export async function completeIssue(issueId) {
  if (!issueId) throw new Error("Issue id is required.");
  const id = encodeURIComponent(String(issueId));
  const user = getUser();
  const workerId = user?.id;
  const query = workerId ? `?workerId=${encodeURIComponent(workerId)}` : "";

  const candidates = [
    `/api/worker/issues/${id}/resolve${query}`,
    `/api/worker/issues/${id}/resolve`,
    `/api/issue/done?id=${id}`,
  ];

  let lastError = null;
  for (const url of candidates) {
    try {
      if (url.startsWith("/api/issue/done")) {
        return await post(url, {});
      }
      return await put(url, {});
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Failed to complete issue.");
}

// ML Prediction Dashboard Endpoints (Flask Port 5000)
export function trainMlModel(token) {
  // Pass the token explicitly if needed, although http.js handles it if getToken() works
  return request("/api/login", {
    method: "POST",
    baseUrl: ML_API_BASE,
    body: JSON.stringify({ token }),
  });
}

export function getMlForecast(days = 30) {
  return request(`/api/forecast?days=${days}`, {
    method: "GET",
    baseUrl: ML_API_BASE,
  });
}

export function getMlHistorical() {
  return request("/api/historical", {
    method: "GET",
    baseUrl: ML_API_BASE,
  });
}

export function getMlStats() {
  return request("/api/stats", {
    method: "GET",
    baseUrl: ML_API_BASE,
  });
}

// Global & Ward Analytics
export function getAnalyticsTimeWise(wardId) {
  const url = wardId
    ? `/api/analytics/issues/time-wise/${wardId}`
    : "/api/analytics/issues/time-wise";
  return get(url);
}

export function getAnalyticsDayWise(wardId, days = 7) {
  const query = makeQuery({ days });
  const url = wardId
    ? `/api/analytics/issues/day-wise/${wardId}?${query}`
    : `/api/analytics/issues/day-wise?${query}`;
  return get(url);
}

export function getAnalyticsCritical(wardId, limit = 10) {
  const query = makeQuery({ limit });
  const url = wardId
    ? `/api/analytics/issues/critical/${wardId}?${query}`
    : `/api/analytics/issues/critical?${query}`;
  return get(url);
}

export function getAnalyticsYearGraph(wardId) {
  if (!wardId) return get("/api/analytics/issues/day-wise?days=365"); // Fallback for overall if needed
  return get(`/api/analytics/issues/year-graph/${wardId}`);
}
