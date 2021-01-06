"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const nodeVisitor_1 = require("./nodeVisitor");
const typescript_1 = require("typescript");
const utils_1 = require("../utils");
const filters_1 = require("../templates/filters");
class CallExpressionVisitor extends nodeVisitor_1.NodeVisitorBase {
    canVisit(node) {
        return node.kind === typescript_1.SyntaxKind.CallExpression;
    }
    doVisit(node, context) {
        if (node.arguments.length !== 0 || !node.typeArguments || node.typeArguments.length !== 2) {
            return;
        }
        const methodCallAccessor = this.visitNext(node.expression, context);
        if (!methodCallAccessor) {
            return;
        }
        const instanceName = methodCallAccessor.name;
        if (instanceName !== context.instanceName) {
            return;
        }
        if (!methodCallAccessor.child) {
            return;
        }
        let scope;
        switch (methodCallAccessor.child.name) {
            case 'addSingleton': {
                scope = 'Singleton';
                break;
            }
            case 'addTransient': {
                scope = 'Transient';
                break;
            }
            default: {
                throw new Error(`Not supported registration-method ${methodCallAccessor.child.name}`);
            }
        }
        const serviceCodeAccessor = this.visitNext(node.typeArguments[0], context);
        if (!serviceCodeAccessor || !serviceCodeAccessor.name) {
            throw Error(`No service type argument is defined for the ${methodCallAccessor.child.name}-method`);
        }
        const usedImports = [];
        const instanceCodeAccessor = this.visitNext(node.typeArguments[1], context);
        if (!instanceCodeAccessor || !instanceCodeAccessor.name) {
            throw Error(`No instance type argument is defined for the ${methodCallAccessor.child.name}-method`);
        }
        const serviceImport = utils_1.addUsedImports(serviceCodeAccessor, context.imports, usedImports);
        let serviceNamespace = "";
        if (serviceImport) {
            serviceNamespace = utils_1.toNamespace(filters_1.getFullPath(serviceImport.relativePath, serviceImport.path));
        }
        const serviceDescriptor = {
            symbolDescriptor: {
                symbolId: utils_1.getSymbolName(serviceCodeAccessor, usedImports),
                symbolNamespace: serviceNamespace
            },
            importFrom: serviceImport,
            displayName: utils_1.getSymbolName(serviceCodeAccessor, usedImports),
            accessorDeclaration: utils_1.getAccessorDeclaration(serviceCodeAccessor, usedImports),
            accessor: serviceCodeAccessor
        };
        const instanceDescriptor = {
            accessor: instanceCodeAccessor,
            constructorArgs: [],
            accessorDeclaration: utils_1.getAccessorDeclaration(instanceCodeAccessor, usedImports),
            displayName: utils_1.getSymbolName(instanceCodeAccessor, usedImports),
            importFrom: utils_1.addUsedImports(instanceCodeAccessor, context.imports, usedImports),
            instanceTypeDefinition: CallExpressionVisitor.getTypeDefinition(instanceCodeAccessor, usedImports)
        };
        const registrationDescriptor = {
            scope: scope,
            imports: usedImports,
            instance: instanceDescriptor,
            service: serviceDescriptor
        };
        context.registrations.push(registrationDescriptor);
    }
    static getTypeDefinition(codeAccessor, imports) {
        let name = codeAccessor.name;
        if (name === '[]') {
            if (codeAccessor.child) {
                return `${CallExpressionVisitor.getTypeDefinition(codeAccessor.child, imports)}[]`;
            }
        }
        if (codeAccessor.child) {
            name = `${name}.${CallExpressionVisitor.getTypeDefinition(codeAccessor.child, imports)}`;
        }
        return name;
    }
}
exports.default = CallExpressionVisitor;