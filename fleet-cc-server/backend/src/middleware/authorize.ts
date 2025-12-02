import { Request, Response, NextFunction } from 'express';

/**
 * Role-based authorization middleware
 * Checks if user has required role(s)
 */
export function authorize(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some(role => userRoles.includes(role));

    if (!hasRole) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

/**
 * Admin-only authorization
 */
export const requireAdmin = authorize('admin');

/**
 * Admin or operator authorization
 */
export const requireOperator = authorize('admin', 'operator');

