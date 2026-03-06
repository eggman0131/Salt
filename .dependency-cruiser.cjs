module.exports = {
  forbidden: [
    {
      name: "no-ui-to-data-or-logic",
      comment: "UI layer must use module API, not logic/data directly.",
      severity: "error",
      from: { path: "^modules_new/[^/]+/ui/" },
      to: { path: "^modules_new/[^/]+/(logic|data)/" },
    },
    {
      name: "no-logic-to-data",
      comment: "Logic must stay pure and never depend on data layer.",
      severity: "error",
      from: { path: "^modules_new/[^/]+/logic/" },
      to: { path: "^modules_new/[^/]+/data/" },
    },
    {
      name: "no-logic-to-firebase",
      comment: "Logic must not import Firebase SDK directly.",
      severity: "error",
      from: { path: "^modules_new/[^/]+/logic/" },
      to: { path: "^firebase($|/)" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    includeOnly: "^(modules|modules_new|types)/",
    exclude: {
      path: "\\.(test|spec)\\.(ts|tsx)$|/__tests__/|/dist/|/lib/",
    },
    reporterOptions: {
      dot: { collapsePattern: "node_modules/[^/]+" },
    },
  },
};
