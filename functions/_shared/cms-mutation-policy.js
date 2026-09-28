export const CMS_POLICY_OPERATIONS=Object.freeze({
  READ:"read",
  PREFLIGHT:"preflight",
  PUBLISH:"publish",
  DIRECT_SAVE:"directSave",
  ROLLBACK:"rollback"
});

const ALL_ROLES=Object.freeze(["admin","editor","operator","viewer"]);
const EDITOR_ROLES=Object.freeze(["admin","editor"]);

export const CMS_PATH_POLICY=Object.freeze({
  "data/home-copy.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:EDITOR_ROLES,directSave:Object.freeze(["admin"]),rollback:Object.freeze(["admin"])
  }),
  "data/content.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:EDITOR_ROLES,directSave:Object.freeze(["admin"]),rollback:Object.freeze(["admin"])
  }),
  "data/knowledge/objects.json":Object.freeze({
    read:Object.freeze(["admin"]),preflight:Object.freeze([]),publish:Object.freeze([]),directSave:Object.freeze(["admin"]),rollback:Object.freeze([])
  }),
  "guide/data.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:EDITOR_ROLES,directSave:Object.freeze([]),rollback:Object.freeze(["admin"])
  }),
  "data/utilities.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:Object.freeze(["admin","operator"]),directSave:Object.freeze([]),rollback:Object.freeze(["admin"])
  }),
  "data/entities/destination-venues.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:Object.freeze(["admin","editor","operator"]),directSave:Object.freeze([]),rollback:Object.freeze(["admin"])
  }),
  "data/entities/food.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:EDITOR_ROLES,directSave:Object.freeze([]),rollback:Object.freeze(["admin"])
  }),
  "data/i18n/vi/food.json":Object.freeze({
    read:ALL_ROLES,preflight:ALL_ROLES,publish:EDITOR_ROLES,directSave:Object.freeze(["admin"]),rollback:Object.freeze([])
  }),
  "data/visual-context.json":Object.freeze({
    read:Object.freeze(["admin","editor","viewer"]),
    preflight:Object.freeze(["admin","editor","viewer"]),
    publish:EDITOR_ROLES,directSave:Object.freeze([]),rollback:Object.freeze([])
  }),
  "cms/users.json":Object.freeze({
    read:Object.freeze(["admin"]),preflight:Object.freeze(["admin"]),publish:Object.freeze(["admin"]),directSave:Object.freeze([]),rollback:Object.freeze([])
  })
});

export function cmsRolesFor(path,operation){
  const entry=CMS_PATH_POLICY[String(path||"")];
  const roles=entry?.[operation];
  return Array.isArray(roles)?roles:[];
}

export function cmsCan(role,path,operation){
  return cmsRolesFor(path,operation).includes(String(role||""));
}

export function cmsSupports(path,operation){
  return cmsRolesFor(path,operation).length>0;
}

export function cmsPathsFor(operation){
  return Object.keys(CMS_PATH_POLICY).filter(path=>cmsSupports(path,operation));
}


export function cmsCanAny(role,operation){
  return cmsPathsFor(operation).some(path=>cmsCan(role,path,operation));
}
