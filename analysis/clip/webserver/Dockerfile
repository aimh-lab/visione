FROM docker.io/python:3.10.9-bullseye

COPY . /usr/src/app
WORKDIR /usr/src/app

RUN pip install --no-cache-dir -r requirements.txt

# Expose port 5030
EXPOSE 5030

# The code to run when container is started:
ENTRYPOINT ["python", "-u", "webserver.py"]