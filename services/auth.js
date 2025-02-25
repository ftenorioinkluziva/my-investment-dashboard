const API_URL = 'https://svc.aebroadcast.com.br/authentication/v1';

export async function login() {
  const payload = {
    login: "widgets-b3@estadao.com",
    password: "any",
    applicationId: "widgets-b3",
    sessionId: "F98ba08a619191612f2d8449c09aa379f"
  };

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Login response:', data);
    return data.token;
  } catch (error) {
    console.error('Error during login:', error);
    throw error;
  }
}