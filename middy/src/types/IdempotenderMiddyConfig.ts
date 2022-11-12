import { IdempotenderConfig } from 'idempotender-core';

import { KeyMapperFunction } from './KeyMapperFunction';

export type IdempotenderMiddyConfig =
    IdempotenderConfig &
    {
        keyJmespath?: string | null;
        keyMapper?: KeyMapperFunction | null;
        validResponseJmespath?: string | null;
    }
