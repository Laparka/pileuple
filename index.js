"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const registrationsParser_1 = __importDefault(require("./generator/registrationsParser"));
const liquidjs_1 = require("liquidjs");
const path = __importStar(require("path"));
const fs_1 = require("fs");
const filters_1 = require("./generator/templates/filters");
const templateDir = path.join(__dirname, 'generator', 'templates');
const resolverTemplatePath = path.join(templateDir, 'resolver.liquid');
const symbolTypesTemplatePath = path.join(templateDir, 'types.liquid');
const serviceProviderTemplatePath = path.join(templateDir, 'serviceProvider.liquid');
const liquid = new liquidjs_1.Liquid();
liquid.registerFilter('toImport', filters_1.toImportFilter);
liquid.registerFilter('toSymbolPath', filters_1.toSymbolPath);
const parser = new registrationsParser_1.default();
function generate(filePath, className, outputDirectory) {
    if (!filePath) {
        throw Error(`The registration module path is required`);
    }
    if (!className) {
        throw Error(`The registration module name is required`);
    }
    if (!outputDirectory) {
        throw Error(`The output directory path is required`);
    }
    const registrations = parser.parse(filePath, className);
    const allSymbols = [];
    const namespaces = [];
    const resolvers = [];
    if (!fs_1.existsSync(outputDirectory)) {
        fs_1.mkdirSync(outputDirectory, { recursive: true });
    }
    for (const r of registrations) {
        const resolverCode = liquid.renderFileSync(resolverTemplatePath, { registration: r, outputDir: outputDirectory });
        const resolverName = [r.instance.displayName, r.service.displayName].join('Of') + `${r.scope}ServiceResolver`;
        const outputFile = resolverName[0].toLowerCase() + resolverName.substring(1, resolverName.length);
        fs_1.writeFileSync(path.join(outputDirectory, `${outputFile}.ts`), resolverCode, { encoding: 'utf8' });
        const symbol = r.service.symbolDescriptor;
        if (symbol.autoGenerated) {
            if (allSymbols.findIndex(s => s.symbolId === symbol.symbolId && s.symbolNamespace === symbol.symbolNamespace) === -1) {
                allSymbols.push(symbol);
            }
            if (namespaces.findIndex(n => n === symbol.symbolNamespace) === -1) {
                namespaces.push(symbol.symbolNamespace);
            }
        }
        resolvers.push(outputFile);
    }
    const symbolsCode = liquid.renderFileSync(symbolTypesTemplatePath, { namespaces, symbols: allSymbols });
    const typesFilePath = path.join(outputDirectory, 'types.generated.ts');
    fs_1.writeFileSync(typesFilePath, symbolsCode, { encoding: 'utf8' });
    const indexCode = liquid.renderFileSync(serviceProviderTemplatePath, { resolvers: resolvers });
    const indexFilePath = path.join(outputDirectory, 'index.ts');
    fs_1.writeFileSync(indexFilePath, indexCode, { encoding: 'utf8' });
    return resolvers;
}
exports.default = generate;
