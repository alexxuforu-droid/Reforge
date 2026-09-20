// Central error type (no-slop §6): every command returns Result<T, AppError>,
// serialized as a tagged { kind, message } object so the frontend branches on
// error SHAPE instead of string-matching a message.
//
// Migration note: the codebase previously used `Result<T, String>` everywhere.
// `From<String>`/`From<&str>` keep every `?`, `.map_err(|e| e.to_string())?`
// and `Err(AppError::Command("...".to_string()))` site compiling through the
// mechanical pass (Phase A2 of TWO_STANDARDS_MASTER_PLAN.md); hot-path commands
// were then refined to the structured variants below so callers can branch by `kind`.
use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("could not access {path}: {source}")]
    Io {
        path: String,
        #[serde(skip)]
        source: std::io::Error,
    },
    #[error("registry error at {key}: {source}")]
    Registry {
        key: String,
        #[serde(skip)]
        source: std::io::Error,
    },
    #[error("command failed: {0}")]
    Command(String),
    #[error("{0}")]
    NotFound(String),
    #[error("{0}")]
    Invalid(String),
}

/// Mechanical-pass bridge: a raw String error becomes a Command error. The
/// message text is preserved verbatim so no user-facing copy changes until a
/// command is deliberately refined to a structured variant.
impl From<String> for AppError {
    fn from(s: String) -> Self {
        AppError::Command(s)
    }
}

impl From<&str> for AppError {
    fn from(s: &str) -> Self {
        AppError::Command(s.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io {
            path: String::new(),
            source: e,
        }
    }
}

/// Typed constructors for new code: prefer these over `AppError::Command(e.to_string())`
/// so the frontend can branch on `{ kind }` instead of string-matching messages.
pub fn io_err(path: impl Into<String>, e: std::io::Error) -> AppError {
    AppError::Io {
        path: path.into(),
        source: e,
    }
}

pub fn registry_err(key: impl Into<String>, e: std::io::Error) -> AppError {
    AppError::Registry {
        key: key.into(),
        source: e,
    }
}
