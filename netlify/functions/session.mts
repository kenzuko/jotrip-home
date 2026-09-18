import type { Config } from "@netlify/functions";
import { session, publicSession, json } from "./_lib/cms.mts";
export default async (req:Request)=>{const s=session(req);if(!s)return json({error:"Chưa đăng nhập"},401);return json(publicSession(s));};
export const config:Config={path:"/api/cms/session"};
