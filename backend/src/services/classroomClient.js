// =============================================
// GOOGLE CLASSROOM CLIENT
// OAuth2 flow + course/material/deadline sync
// =============================================

const { google } = require("googleapis");

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || "http://localhost:3001/auth/google/callback"
  );
}

function getGoogleLoginUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "online",
    prompt: "select_account",
    state: "login",
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
    ],
  });
}

function getClassroomAuthUrl() {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    state: "classroom",
    scope: [
      "openid",
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/userinfo.profile",
      "https://www.googleapis.com/auth/classroom.courses.readonly",
      "https://www.googleapis.com/auth/classroom.coursework.me.readonly",
      "https://www.googleapis.com/auth/classroom.courseworkmaterials.readonly",
    ],
  });
}

function getAuthUrl() {
  return getClassroomAuthUrl();
}

async function exchangeCode(code) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

function getClassroomClient(tokens) {
  const auth = getOAuthClient();
  auth.setCredentials(tokens);
  return google.classroom({ version: "v1", auth });
}

async function listCourses(tokens) {
  const classroom = getClassroomClient(tokens);
  const res = await classroom.courses.list({ courseStates: ["ACTIVE"] });
  return (res.data.courses || []).map(c => ({
    id: c.id,
    name: c.name,
    teacher: c.ownerId,
    section: c.section,
    enrollmentCode: c.enrollmentCode,
  }));
}

async function listCourseWork(tokens, courseId) {
  const classroom = getClassroomClient(tokens);
  try {
    const res = await classroom.courses.courseWork.list({ courseId, orderBy: "dueDate desc" });
    return res.data.courseWork || [];
  } catch { return []; }
}

async function listMaterials(tokens, courseId) {
  const classroom = getClassroomClient(tokens);
  try {
    const res = await classroom.courses.courseWorkMaterials.list({ courseId });
    return res.data.courseWorkMaterial || [];
  } catch { return []; }
}

module.exports = { getAuthUrl, getGoogleLoginUrl, getClassroomAuthUrl, exchangeCode, listCourses, listCourseWork, listMaterials };
