import {onRequest as cmsSession} from "../session.js";
import {adminFeedback} from "../../../_shared/place-feedback.js";
export const onRequest=({request,env})=>adminFeedback(request,env,cmsSession,{photo:true});
