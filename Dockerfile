
FROM      node:11.14-slim

RUN       mkdir /etc/fusion

COPY      . /etc/fusion

WORKDIR   /etc/fusion

RUN       yarn

CMD       [ "node", "." ]