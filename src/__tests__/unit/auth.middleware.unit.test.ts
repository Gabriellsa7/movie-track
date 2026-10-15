import { NextFunction, Request, Response } from 'express';
import {
  authenticate,
} from '../../interfaces/http/middlewares/auth.middleware';
import { ITokenProvider } from '../../domain/common/providers/token.provider';
import { UnauthorizedError } from '../../domain/errors/unauthorized.error';

let tokenProvider: jest.Mocked<ITokenProvider>;
let next: jest.MockedFunction<NextFunction>;
const res = {} as Response;

function requestWith(authorization?: string): Request {
  return { headers: { authorization } } as Request;
}

beforeEach(() => {
  tokenProvider = {
    generateAccessToken: jest.fn(),
    verifyAccessToken: jest.fn(),
    generateRefreshToken: jest.fn(),
    verifyRefreshToken: jest.fn(),
  };
  next = jest.fn();
});

describe('When we authenticate a request', () => {
  it('should set the user id and continue for a valid bearer token', () => {
    tokenProvider.verifyAccessToken.mockReturnValue({ sub: 'user-1' });
    const req = requestWith('Bearer valid-token');

    authenticate(tokenProvider)(req, res, next);

    expect(tokenProvider.verifyAccessToken).toHaveBeenCalledWith('valid-token');
    expect(req.userId).toBe('user-1');
    expect(next).toHaveBeenCalledWith();
  });

  it('should accept the scheme in any letter case', () => {
    tokenProvider.verifyAccessToken.mockReturnValue({ sub: 'user-1' });

    authenticate(tokenProvider)(requestWith('bearer valid-token'), res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it.each([undefined, 'valid-token', 'Basic dXNlcjpwYXNz', 'Bearer '])(
    'should reject the authorization header %p',
    (authorization) => {
      authenticate(tokenProvider)(requestWith(authorization), res, next);

      expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
      expect(tokenProvider.verifyAccessToken).not.toHaveBeenCalled();
    },
  );

  it('should forward the error of an invalid token', () => {
    const tokenError = new UnauthorizedError('Token expired', 'TOKEN_EXPIRED');
    tokenProvider.verifyAccessToken.mockImplementation(() => {
      throw tokenError;
    });
    const req = requestWith('Bearer expired-token');

    authenticate(tokenProvider)(req, res, next);

    expect(next).toHaveBeenCalledWith(tokenError);
    expect(req.userId).toBeUndefined();
  });
});
