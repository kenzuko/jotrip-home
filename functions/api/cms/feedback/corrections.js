import {onRequest as cmsSession} from "../session.js";
import {adminCorrections} from "../../../_shared/place-feedback.js";
export const onRequest=({request,env})=>adminCorrections(request,env,cmsSession);
